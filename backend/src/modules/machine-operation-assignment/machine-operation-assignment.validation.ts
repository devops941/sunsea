import { z } from "zod";

const operatorSchema = z.object({
  roleId: z.number({ message: "Role is required" }),
  employeeId: z.union([z.string(), z.number()]),
});

const baseAssignmentSchema = z.object({
  machineId: z.string().min(1, "Machine is required"),
  shiftId: z.string().nullable().optional(),
  weekStartDate: z.string().min(1, "Week Start Date is required"),
  weekEndDate: z.string().min(1, "Week End Date is required"),
  inchargeRoleId: z.number().nullable().optional(),
  inchargeEmployeeId: z.union([z.string(), z.number()]).nullable().optional(),
  operators: z.array(operatorSchema).optional().default([]),
  remarks: z.string().max(255, "Remarks cannot exceed 255 characters").nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const createMachineAssignmentSchema = baseAssignmentSchema
  .refine(
    (data) => {
      const start = new Date(data.weekStartDate);
      const end = new Date(data.weekEndDate);
      return end >= start;
    },
    {
      message: "Week End Date must be greater than or equal to Week Start Date",
      path: ["weekEndDate"],
    }
  )
  .refine(
    (data) => {
      if (data.operators && data.operators.length > 0) {
        const employeeIds = data.operators.map(o => String(o.employeeId));
        return new Set(employeeIds).size === employeeIds.length;
      }
      return true;
    },
    {
      message: "Duplicate operators are not allowed",
      path: ["operators"],
    }
  );

export const updateMachineAssignmentSchema = baseAssignmentSchema.partial();
