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
      .max(20)
      .optional()
      .nullable(),

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
      
    shortClosePO: z.boolean().optional(),

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

    selectedOperatorIds: z
      .string()
      .max(255)
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

    shortClosePO: z.boolean().optional(),

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

    selectedOperatorIds: z
      .string()
      .max(255)
      .optional()
      .nullable(),
  }),
});

export type CreateDailyPlanInput = z.infer<typeof createDailyPlanSchema>["body"];
export type UpdateDailyPlanInput = z.infer<typeof updateDailyPlanSchema>["body"];

export const bulkCreateDailyPlanSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productionOrderId: z.string().min(1).max(20),
        machineId: z.string().min(1).max(20),
        shiftId: z.string().min(1).max(20),
        productionDate: z
          .string()
          .refine((val) => !isNaN(Date.parse(val)), "Invalid date format (use YYYY-MM-DD)"),
        plannedQty: z.number().positive("Planned Quantity must be greater than 0"),
        weeklyProgramId: z.string().max(20).optional().nullable(),
      })
    ).min(0),
    status: z.enum(["DRAFT", "PLANNED"]).optional().default("DRAFT"),
    weekStart: z.string().optional().nullable(),
  }),
});

export type BulkCreateDailyPlanInput = z.infer<typeof bulkCreateDailyPlanSchema>["body"];

export const bulkDeleteDailyPlanSchema = z.object({
  body: z.object({
    dailyPlanIds: z.array(z.string()).min(1, "At least one daily plan ID is required"),
  }),
});

export type BulkDeleteDailyPlanInput = z.infer<typeof bulkDeleteDailyPlanSchema>["body"];

export const issueRawMaterialsSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
    items: z
      .array(
        z.object({
          rawMaterialId: z.string().min(1).max(20),
          storeId: z.string().min(1).max(20),
          issuedQty: z.number().positive("Issued quantity must be greater than 0"),
          remarks: z.string().max(255).optional(),
        })
      )
      .min(1, "At least one item is required"),
  }),
});

