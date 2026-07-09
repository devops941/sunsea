import { z } from "zod";

export const getDailyScheduleQuerySchema = z.object({
  query: z.object({
    weekStartDate: z
      .string()
      .min(1, "weekStartDate is required")
      .refine((val) => !isNaN(Date.parse(val)), "Invalid weekStartDate format"),
    weekEndDate: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), "Invalid weekEndDate format"),
    machineId: z
      .string()
      .min(1, "machineId is required"),
    dayOfWeek: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .refine((val) => val === undefined || (val >= 1 && val <= 7), "dayOfWeek must be between 1 and 7"),
    shiftId: z.string().optional(),
    status: z.string().optional(),
  }),
});

export type GetDailyScheduleQueryInput = z.infer<typeof getDailyScheduleQuerySchema>["query"];
