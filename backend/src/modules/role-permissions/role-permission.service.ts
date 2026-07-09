import { prisma } from "../../config/prisma";

export const assignPermissionsToRole =
  async (
    roleId: number,
    permissionIds: number[]
  ) => {
    const data = permissionIds.map(
      (permissionId) => ({
        roleId,
        permissionId,
      })
    );

    return prisma.rolePermission.createMany({
      data,
      skipDuplicates: true,
    });
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
    permissionId: number
  ) => {
    return prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
  };