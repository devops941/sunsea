import { z } from "zod";

export const assignPermissionsSchema = z.object({
  body: z.object({
    roleId: z.coerce.bigint(),
    permissionIds: z.array(
      z.coerce.bigint()
    ).min(1),
  }),
});

export const removePermissionSchema = z.object({
  body: z.object({
    roleId: z.coerce.bigint(),
    permissionId: z.coerce.bigint(),
  }),
});