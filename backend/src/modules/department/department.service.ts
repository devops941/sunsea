import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const createDepartmentService =
  async (
    payload: {
      name: string;
      description?: string | null;
      userId?: string;
    }
  ) => {
    const { userId, ...departmentData } = payload;
    const initialEditHistory = userId
      ? [{ updatedBy: userId, updatedAt: new Date().toISOString() }]
      : [];

    const exists =
      await prisma.department.findFirst({
        where: {
          name: departmentData.name
        },
      });

    if (exists) {
      throw new ApiError(
        409,
        "Department already exists"
      );
    }

    return prisma.department.create({
      data: {
        ...departmentData,
        createdBy: userId || undefined,
        updatedBy: userId || undefined,
        editHistory: initialEditHistory.length > 0 ? initialEditHistory : undefined,
      } as any,
    });
  };

export const getAllDepartmentsService =
  async (page?: number, limit?: number, search?: string) => {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const [departments, total] = await Promise.all([
        prisma.department.findMany({
          where,
          include: {
            _count: { select: { employees: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.department.count({ where }),
      ]);
      return { departments, total };
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: {
          select: { employees: true }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return { departments, total: departments.length };
  };

export const deleteDepartmentService =
  async (id: number) => {
    const department =
      await prisma.department.findUnique({
        where: { id },
      });

    if (!department) {
      throw new ApiError(
        404,
        "Department not found"
      );
    }

    const employeesWithDepartment = await prisma.employee.findFirst({
      where: {
        departmentId: id,
        status: { not: "draft" },
      },
    });

    if (employeesWithDepartment) {
      throw new ApiError(400, "This department is currently assigned to one or more employees and cannot be deleted.");
    }

    return prisma.department.delete({
      where: { id },
    });
  };

// Edit and update department
export const updateDepartmentService =
  async (
    id: number,
    payload: {
      name?: string;
      description?: string | null;
      userId?: string;
    }
  ) => {
    const currentDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!currentDepartment) {
      throw new ApiError(404, "Department not found");
    }

    const { userId, ...departmentData } = payload;

    const existingDepartment =
      await prisma.department.findFirst({
        where: {
          AND: [
            {
              id: {
                not: id,
              },
            },
            departmentData.name ? { name: departmentData.name } : {}
          ],
        },
      });

    if (existingDepartment) {
      throw new ApiError(
        409,
        "Department already exists"
      );
    }

    let newEditHistory: any[] = [];
    let rawHistory = (currentDepartment as any).editHistory;
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
    } else if ((currentDepartment as any).createdBy || currentDepartment.createdAt) {
      newEditHistory.push({
        updatedBy: (currentDepartment as any).createdBy || "System",
        updatedAt: currentDepartment.createdAt ? new Date(currentDepartment.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    const updatePayload: any = {
      ...departmentData,
      updatedBy: userId || undefined,
      editHistory: newEditHistory.length > 0 ? newEditHistory : undefined,
    };

    return prisma.department.update({
      where: { id },
      data: updatePayload,
    });
  };

export const getDepartmentByIdService =
  async (id: number) => {
    const department =
      await prisma.department.findUnique({
        where: { id },
      });

    if (!department) {
      throw new ApiError(
        404,
        "Department not found"
      );
    }

    let createdUserName = "Unknown User";
    let createdUserRole = "Unknown Role";
    const deptWithAudit = department as any;

    if (deptWithAudit.createdBy) {
      if (deptWithAudit.createdBy.startsWith("admin_")) {
        const adminId = BigInt(deptWithAudit.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.fullName || admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        } else {
          createdUserName = deptWithAudit.createdBy;
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: deptWithAudit.createdBy },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.fullName || user.username;
          createdUserRole = user.role?.name || "User";
        } else {
          createdUserName = deptWithAudit.createdBy;
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    let rawHistory = deptWithAudit.editHistory;
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
      ...department,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  };