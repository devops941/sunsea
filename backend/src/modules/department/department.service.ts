import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const createDepartmentService =
  async (
    payload: {
      name: string;
      description?: string | null;
    }
  ) => {

    const exists =
      await prisma.department.findFirst({
        where: {
          name: payload.name
        },
      });

    if (exists) {
      throw new ApiError(
        409,
        "Department already exists"
      );
    }

    return prisma.department.create({
      data: payload,
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
      },
    });

    if (employeesWithDepartment) {
      throw new ApiError(400, "This department is currently assigned to one or more employees and cannot be deleted.");
    }

    return prisma.department.delete({
      where: { id },
    });
  }

// Editand update department
export const updateDepartmentService =
  async (
    id: number,
    payload: {
      name?: string;
      description?: string | null;
    }
  ) => {

    await getDepartmentByIdService(id);

    const employeesWithDepartment = await prisma.employee.findFirst({
      where: {
        departmentId: id,
      },
    });

    if (employeesWithDepartment) {
      throw new ApiError(400, "This department is currently assigned to one or more employees and cannot be edited.");
    }

    const existingDepartment =
      await prisma.department.findFirst({
        where: {
          AND: [
            {
              id: {
                not: id,
              },
            },
            payload.name ? { name: payload.name } : {}
          ],
        },
      });

    if (existingDepartment) {
      throw new ApiError(
        409,
        "Department already exists"
      );
    }

    return prisma.department.update({
      where: { id },
      data: payload,
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

    return department;
  };