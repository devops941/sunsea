import { z } from "zod";

export const createDesignationSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(2, "Designation code is required")
      .max(20),

    name: z
      .string()
      .min(2, "Designation name is required")
      .max(100),
  }),
});

export const designationIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, "Invalid designation id"),
  }),
});