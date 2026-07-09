import { z } from "zod";

export const createDepartmentSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(2, "Department code is required")
      .max(20),

    name: z
      .string()
      .min(2, "Department name is required")
      .max(100),
  }),
});

export const updateDepartmentSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(2)
      .max(20)
      .optional(),

    name: z
      .string()
      .min(2)
      .max(100)
      .optional(),
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