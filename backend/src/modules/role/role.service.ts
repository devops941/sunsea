import { prisma } from "../../config/prisma";

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
  return prisma.role.delete({
    where: {
      id,
    },
  });
};