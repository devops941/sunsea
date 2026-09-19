import { prisma } from "../../config/prisma";
import { logAudit } from "../../utils/auditLog.util";

export const createRole = async (
  data: {
    code: string;
    name: string;
    description?: string;
    status?: "active" | "inactive";
    userId?: string;
  }
) => {
  const { userId, ...roleData } = data;
  const initialEditHistory = userId
    ? [{ updatedBy: userId, updatedAt: new Date().toISOString() }]
    : [];

  const createdRole = await prisma.role.create({
    data: {
      ...roleData,
      createdBy: userId || undefined,
      updatedBy: userId || undefined,
      editHistory: initialEditHistory.length > 0 ? initialEditHistory : undefined,
    } as any,
  });

  await logAudit("Role", createdRole.code || createdRole.id.toString(), "CREATE", userId, createdRole.name);
  return createdRole;
};

const SUPER_ADMIN_FILTER = [
  { code: { in: ["ROLE_ADMIN", "SUPER_ADMIN", "super_admin", "superadmin"] } },
  { name: { contains: "Super Admin", mode: "insensitive" } },
  { name: { contains: "superadmin", mode: "insensitive" } },
];

export const getAllRoles = async (page?: number, limit?: number, search?: string) => {
  const where: any = {
    NOT: SUPER_ADMIN_FILTER,
  };
  if (search) {
    where.AND = [
      { NOT: SUPER_ADMIN_FILTER },
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
  const role = await prisma.role.findUnique({
    where: {
      id,
    },
  });

  if (!role) {
    return null;
  }

  let createdUserName = "Unknown User";
  let createdUserRole = "Unknown Role";
  const roleWithAudit = role as any;

  if (roleWithAudit.createdBy) {
    if (roleWithAudit.createdBy.startsWith("admin_")) {
      const adminId = BigInt(roleWithAudit.createdBy.replace("admin_", ""));
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { username: true, fullName: true, role: { select: { name: true } } },
      });
      if (admin) {
        createdUserName = admin.fullName || admin.username;
        createdUserRole = admin.role?.name || "Super Admin";
      } else {
        createdUserName = roleWithAudit.createdBy;
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { userId: roleWithAudit.createdBy },
        select: { username: true, fullName: true, role: { select: { name: true } } },
      });
      if (user) {
        createdUserName = user.fullName || user.username;
        createdUserRole = user.role?.name || "User";
      } else {
        createdUserName = roleWithAudit.createdBy;
      }
    }
  }

  // Resolve names for editHistory
  let enrichedEditHistory: any[] = [];
  let rawHistory = roleWithAudit.editHistory;
  if (typeof rawHistory === "string") {
    try {
      rawHistory = JSON.parse(rawHistory);
    } catch (e) {
      rawHistory = [];
    }
  }

  if (Array.isArray(rawHistory)) {
    enrichedEditHistory = await Promise.all(
      rawHistory.map(async (edit: any) => {
        let name = edit.updatedByName || edit.updatedBy || "Unknown User";
        if (edit.updatedBy) {
          if (edit.updatedBy.startsWith("admin_")) {
            const adminId = BigInt(edit.updatedBy.replace("admin_", ""));
            const admin = await prisma.admin.findUnique({
              where: { id: adminId },
              select: { username: true, fullName: true },
            });
            if (admin) name = admin.fullName || admin.username;
          } else {
            const user = await prisma.user.findUnique({
              where: { userId: edit.updatedBy },
              select: { username: true, fullName: true },
            });
            if (user) name = user.fullName || user.username;
          }
        }
        return { ...edit, updatedByName: name };
      })
    );
  }

  return {
    ...role,
    createdUserName,
    createdUserRole,
    editHistory: enrichedEditHistory,
  };
};

export const updateRole = async (
  id: number,
  data: {
    code?: string;
    name?: string;
    description?: string;
    status?: "active" | "inactive";
    userId?: string;
  }
) => {
  const currentRole = await prisma.role.findUnique({
    where: { id },
  });

  if (!currentRole) {
    throw new Error("Role not found");
  }

  const { userId, ...roleData } = data;
  const updatePayload: any = { ...roleData };

  let newEditHistory: any[] = [];
  let rawHistory = (currentRole as any).editHistory;
  if (typeof rawHistory === "string") {
    try {
      rawHistory = JSON.parse(rawHistory);
    } catch (e) {
      rawHistory = [];
    }
  }

  if (Array.isArray(rawHistory) && rawHistory.length > 0) {
    newEditHistory = rawHistory.map((item: any) => ({
      updatedBy: item.updatedBy,
      updatedAt: item.updatedAt,
    }));
  } else if ((currentRole as any).createdBy || currentRole.createdAt) {
    newEditHistory.push({
      updatedBy: (currentRole as any).createdBy || "System",
      updatedAt: currentRole.createdAt ? new Date(currentRole.createdAt).toISOString() : new Date().toISOString(),
    });
  }

  if (userId) {
    newEditHistory.push({
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    });
  }

  updatePayload.updatedBy = userId || undefined;
  updatePayload.editHistory = newEditHistory.length > 0 ? newEditHistory : undefined;

  const updatedRole = await prisma.role.update({
    where: {
      id,
    },
    data: updatePayload,
  });

  await logAudit("Role", updatedRole.code || updatedRole.id.toString(), "UPDATE", userId, updatedRole.name);
  return updatedRole;
};

export const deleteRole = async (
  id: number,
  userId?: string
) => {
  const role = await prisma.role.findUnique({ where: { id }});
  if (!role) throw new Error("Role not found");

  const assignedUsers = await prisma.user.findFirst({ where: { roleId: id } });
  if (assignedUsers) throw new Error("Cannot delete role because it is assigned to one or more users.");

  const assignedAdmins = await prisma.admin.findFirst({ where: { roleId: id } });
  if (assignedAdmins) throw new Error("Cannot delete role because it is assigned to one or more admins.");

  const deletedRole = await prisma.role.delete({
    where: {
      id,
    },
  });

  await logAudit("Role", deletedRole.code || deletedRole.id.toString(), "DELETE", userId, deletedRole.name);
  return deletedRole;
};