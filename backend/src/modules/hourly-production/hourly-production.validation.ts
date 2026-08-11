import { z } from "zod";

/**
 * Create Hourly Production Validation
 */
export const createHourlyProductionSchema = z.object({
  body: z.object({
    dailyPlanId: z
      .string()
      .max(50)
      .optional()
      .nullable(),

    productionOrderId: z
      .string()
      .min(1, "Production Order ID is required")
      .max(20),

    productionDate: z
      .string()
      .min(1, "Production Date is required"),

    shiftId: z
      .string()
      .min(1, "Shift ID is required")
      .max(20),

    machineId: z
      .string()
      .min(1, "Machine ID is required")
      .max(20),

    hourIndex: z
      .number()
      .int()
      .min(-100000, "Hour Index must be at least -100000")
      .max(24, "Hour Index cannot exceed 24"),

    qtyProduced: z
      .number()
      .nonnegative("Qty Produced cannot be negative"),

    rejectQty: z
      .number()
      .nonnegative("Reject Qty cannot be negative")
      .optional()
      .default(0),

    scrapQty: z
      .number()
      .nonnegative("Scrap Qty cannot be negative")
      .optional()
      .default(0),

    downtime: z
      .number()
      .nonnegative("Downtime cannot be negative")
      .optional()
      .default(0),

    remarks: z
      .string()
      .max(255)
      .optional(),

    operatorId: z
      .string()
      .max(20)
      .optional()
      .nullable(),

    downtimeReason: z
      .string()
      .max(100)
      .optional()
      .nullable(),

    rejectReason: z
      .string()
      .max(100)
      .optional()
      .nullable(),

    scrapReason: z
      .string()
      .max(100)
      .optional()
      .nullable(),

    runtimeMinutes: z
      .number()
      .nonnegative("Runtime cannot be negative")
      .max(60, "Runtime cannot exceed 60 minutes per slot")
      .optional()
      .default(60),

    stopPlanEarly: z
      .boolean()
      .optional(),
  }),
});

/**
 * Update Hourly Production Validation
 */
export const updateHourlyProductionSchema = z.object({
  body: createHourlyProductionSchema
    .shape
    .body
    .partial(),

  params: z.object({
    hourlyProductionId: z
      .string()
      .regex(/^\d+$/, "Hourly Production ID must be a numeric string"),
  }),
});

/**
 * Hourly Production ID Validation
 */
export const hourlyProductionIdSchema = z.object({
  params: z.object({
    hourlyProductionId: z
      .string()
      .regex(/^\d+$/, "Hourly Production ID must be a numeric string"),
  }),
});

export type CreateHourlyProductionInput = z.infer<typeof createHourlyProductionSchema>["body"];
export type UpdateHourlyProductionInput = z.infer<typeof updateHourlyProductionSchema>["body"];
