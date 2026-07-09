import { z } from "zod";

export const createPermissionSchema = z.object({
  body: z.object({
    key: z.string().min(3),
    module: z.string().min(2),
    action: z.string().min(2),
    scope: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const updatePermissionSchema = z.object({
  body: z.object({
    module: z.string().optional(),
    action: z.string().optional(),
    scope: z.string().optional(),
    description: z.string().optional(),
  }),
});