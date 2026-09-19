import { prisma } from "../../config/prisma";
import { logAudit } from "../../utils/auditLog.util";

export const assignPermissionsToRole =
  async (
    roleId: number,
    permissionIds: number[],
    userId?: string
  ) => {
    const data = permissionIds.map(
      (permissionId) => ({
        roleId,
        permissionId,
      })
    );

    const result = await prisma.rolePermission.createMany({
      data,
      skipDuplicates: true,
    });
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    await logAudit("RolePermission", roleId.toString(), "UPDATE", userId, role ? `Permissions for ${role.name}` : undefined);
    return result;
  };

export const getRolePermissions =
  async (roleId: number) => {
    return prisma.role.findUnique({
      where: {
        id: roleId,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  };

export const removePermissionFromRole =
  async (
    roleId: number,
    permissionId: number,
    userId?: string
  ) => {
    const result = await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    await logAudit("RolePermission", roleId.toString(), "UPDATE", userId, role ? `Permissions for ${role.name}` : undefined);
    return result;
  };