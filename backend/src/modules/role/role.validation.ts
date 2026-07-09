import { z } from "zod";

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional(),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.enum([
      "active",
      "inactive",
    ]).optional(),
  }),
});