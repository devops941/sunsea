import { z } from "zod";

/**
 * Create Hourly Production Validation
 */
export const createHourlyProductionSchema = z.object({
  body: z.object({
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
      .min(0, "Hour Index must be at least 0")
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
