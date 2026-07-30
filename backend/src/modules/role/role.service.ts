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

export const getAllRoles = async (page?: number, limit?: number, search?: string) => {
  const where: any = {
    // Never expose the Super Admin role in the management list
    NOT: { code: "ROLE_ADMIN" },
  };
  if (search) {
    where.AND = [
      { NOT: { code: "ROLE_ADMIN" } },
      { OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]},
    ];
    delete where.NOT; // replaced by AND above
  }

  if (page !== undefined && limit !== undefined) {
    const skip = (page - 1) * limit;
    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.role.count({ where }),
    ]);
    return { roles, total };
  }

  const roles = await prisma.role.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
  });
  return { roles, total: roles.length };
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
  const assignedUsers = await prisma.user.findFirst({ where: { roleId: id } });
  if (assignedUsers) throw new Error("Cannot delete role because it is assigned to one or more users.");

  const assignedAdmins = await prisma.admin.findFirst({ where: { roleId: id } });
  if (assignedAdmins) throw new Error("Cannot delete role because it is assigned to one or more admins.");

  return prisma.role.delete({
    where: {
      id,
    },
  });
};