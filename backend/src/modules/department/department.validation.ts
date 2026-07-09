import { z } from "zod";

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Department name is required")
      .max(100),
    description: z
      .string()
      .max(500)
      .optional()
      .nullable(),
  }),
});

export const updateDepartmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2)
      .max(100)
      .optional(),
    description: z
      .string()
      .max(500)
      .optional()
      .nullable(),
  }),

  params: z.object({
    id: z.string(),
  }),
});

export const departmentIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});