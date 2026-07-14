import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const createRole = async (
  data: {
    code: string;
    name: string;
    description?: string;
  }
) => {
  return prisma.role.create({
    data,
  });
};

export const getAllRoles = async () => {
  return prisma.role.findMany({
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getRoleById = async (
  id: number
) => {
  return prisma.role.findUnique({
    where: {
      id,
    },
  });
};

export const updateRole = async (
  id: number,
  data: {
    code?: string;
    name?: string;
    description?: string;
    status?: "active" | "inactive";
  }
) => {
  const usersWithRole = await prisma.user.findFirst({
    where: {
      roleId: id,
    },
  });

  if (usersWithRole) {
    throw new ApiError(400, "This role is currently assigned to one or more users and cannot be edited.");
  }

  return prisma.role.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteRole = async (
  id: number
) => {
  const usersWithRole = await prisma.user.findFirst({
    where: {
      roleId: id,
    },
  });

  if (usersWithRole) {
    throw new ApiError(400, "This role is currently assigned to one or more users and cannot be deleted.");
  }

  return prisma.role.delete({
    where: {
      id,
    },
  });
};