import { z } from "zod";

export const wastageItemSchema = z.object({
  targetWastageProductId: z.string().min(1, "Wastage Raw Material / Scrap is required"),
  quantity: z.number().positive("Wastage Quantity must be greater than 0"),
  storeId: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  selectedUom: z.string().optional().nullable(),
  baseUom: z.string().optional().nullable(),
  narration: z.string().max(255).optional().nullable(),
});

export const hourlyEntrySchema = z.object({
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
    .max(60, "Downtime cannot exceed 60 minutes per slot")
    .optional()
    .default(0),
  runtimeMinutes: z
    .number()
    .nonnegative("Runtime cannot be negative")
    .max(60, "Runtime cannot exceed 60 minutes per slot")
    .optional()
    .default(60),
  remarks: z
    .string()
    .max(255)
    .optional()
    .nullable(),
  operatorId: z
    .string()
    .max(50)
    .optional()
    .nullable(),
  operatorName: z
    .string()
    .max(100)
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
  status: z
    .string()
    .max(50)
    .optional()
    .nullable(),
  operationName: z
    .string()
    .max(100)
    .optional()
    .nullable(),
});

export const hourlyProductionBodySchema = z.object({
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

  // Support for full shift hourlyEntries array
  hourlyEntries: z
    .array(hourlyEntrySchema)
    .optional(),

  // Support for single hour entry (backwards compatibility)
  hourIndex: z
    .number()
    .int()
    .min(-100000)
    .max(24)
    .optional(),

  qtyProduced: z
    .number()
    .nonnegative()
    .optional(),

  rejectQty: z
    .number()
    .nonnegative()
    .optional()
    .default(0),

  scrapQty: z
    .number()
    .nonnegative()
    .optional()
    .default(0),

  downtime: z
    .number()
    .nonnegative()
    .max(60)
    .optional()
    .default(0),

  runtimeMinutes: z
    .number()
    .nonnegative()
    .max(60)
    .optional()
    .default(60),

  remarks: z
    .string()
    .max(255)
    .optional()
    .nullable(),

  operatorId: z
    .string()
    .max(50)
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

  stopPlanEarly: z
    .boolean()
    .optional(),

  logWastage: z
    .boolean()
    .optional(),

  totalScrapQty: z
    .number()
    .nonnegative()
    .optional(),

  totalRejectQty: z
    .number()
    .nonnegative()
    .optional(),

  wastages: z
    .array(wastageItemSchema)
    .optional()
    .default([]),

  rawMaterialsUsed: z
    .array(z.any())
    .optional()
    .default([]),
});

/**
 * Create / Upsert Hourly Production Validation
 */
export const createHourlyProductionSchema = z.object({
  body: hourlyProductionBodySchema.refine((data) => {
    if (data.hourIndex !== undefined && data.qtyProduced !== undefined) {
      if (data.hourIndex > 0 && (data.rejectQty ?? 0) > data.qtyProduced) {
        return false;
      }
    }
    if (data.hourlyEntries && Array.isArray(data.hourlyEntries)) {
      for (const entry of data.hourlyEntries) {
        if (entry.hourIndex > 0 && (entry.rejectQty ?? 0) > entry.qtyProduced) {
          return false;
        }
      }
    }
    return true;
  }, {
    message: "Reject Quantity cannot exceed Quantity Produced",
    path: ["rejectQty"],
  }),
});

/**
 * Update Hourly Production Validation
 */
export const updateHourlyProductionSchema = z.object({
  body: hourlyProductionBodySchema.partial(),

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

export const removeHourlyEntriesSchema = z.object({
  body: z.object({
    productionOrderId: z.string().min(1, "Production Order ID is required").max(20),
    machineId: z.string().min(1, "Machine ID is required").max(20),
    shiftId: z.string().min(1, "Shift ID is required").max(20),
    productionDate: z.string().min(1, "Production Date is required"),
    hourIndexes: z.array(z.number().int()).min(1, "At least one hour index is required"),
  }),
});

export type RemoveHourlyEntriesInput = z.infer<typeof removeHourlyEntriesSchema>["body"];
export type CreateHourlyProductionInput = z.infer<typeof createHourlyProductionSchema>["body"];
export type UpdateHourlyProductionInput = z.infer<typeof updateHourlyProductionSchema>["body"];
export type HourlyEntry = z.infer<typeof hourlyEntrySchema>;
