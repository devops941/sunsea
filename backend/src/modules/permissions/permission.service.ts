import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

interface CreatePermissionInput {
  key: string;
  module: string;
  action: string;
  scope?: string;
  description?: string;
}

interface UpdatePermissionInput {
  module?: string;
  action?: string;
  scope?: string;
  description?: string;
}

class PermissionService {
  async createPermission(
    data: CreatePermissionInput
  ) {
    const existingPermission =
      await prisma.permission.findUnique({
        where: {
          key: data.key,
        },
      });

    if (existingPermission) {
      throw new ApiError(
        409,
        "Permission already exists"
      );
    }

    return prisma.permission.create({
      data: {
        key: data.key,
        module: data.module,
        action: data.action,
        scope: data.scope,
        description: data.description,
      },
    });
  }

  async getAllPermissions() {
    return prisma.permission.findMany({
      orderBy: {
        id: "desc",
      },
    });
  }

  async getPermissionById(
    id: number
  ) {
    const permission =
      await prisma.permission.findUnique({
        where: { id },
      });

    if (!permission) {
      throw new ApiError(
        404,
        "Permission not found"
      );
    }

    return permission;
  }

  async updatePermission(
    id: number,
    data: UpdatePermissionInput
  ) {
    await this.getPermissionById(id);

    return prisma.permission.update({
      where: { id },
      data,
    });
  }

  async deletePermission(
    id: number
  ) {
    await this.getPermissionById(id);

    return prisma.permission.delete({
      where: { id },
    });
  }
}

export default new PermissionService();