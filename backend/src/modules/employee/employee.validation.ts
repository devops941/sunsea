import { z } from "zod";

export const createEmployeeSchema = z.object({
  body: z.object({
    empCode: z.string().min(1),
    fullName: z.string().min(1),
    mobile: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    departmentId: z.number().optional().nullable(),
    status: z.enum(["active", "inactive", "resigned", "terminated"]).optional(),
    createLoginAccount: z.boolean().optional(),
    loginAccount: z.object({
      username: z.string().min(3),
      password: z.string().min(6).optional().or(z.literal("")), // optional for edits
      roleId: z.number(),
      status: z.enum(["active", "suspended", "locked"]).optional(),
    }).optional().nullable(),
  }),
});

export const updateEmployeeSchema = z.object({
  body: createEmployeeSchema.shape.body.partial(),
  params: z.object({
    id: z.string(),
  }),
});

export const employeeIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});