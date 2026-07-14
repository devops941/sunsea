import { z } from "zod";

export const createEmployeeSchema = z.object({
  body: z.object({
    // BUG-EMP-005 fix: added max(20) to empCode
    empCode: z.string().min(1, "Employee code is required").max(20, "Employee code must be at most 20 characters"),
    fullName: z.string().min(1, "Full name is required"),
    // BUG-EMP-001 fix: mobile is now optional on backend (nullable) — consistent with Create UI
    mobile: z
      .string()
      .min(10, "Mobile number must be at least 10 digits")
      .optional()
      .nullable(),
    // BUG-EMP-002 fix: email is now optional on backend — consistent with Create UI
    email: z
      .string()
      .email("Invalid email format")
      .optional()
      .nullable(),
    departmentId: z.number().optional().nullable(),
    status: z.enum(["active", "inactive", "resigned", "terminated"]).optional(),
    createLoginAccount: z.boolean().optional(),
    loginAccount: z.object({
      username: z.string().min(3, "Username must be at least 3 characters"),
      password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")), // optional for edits
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