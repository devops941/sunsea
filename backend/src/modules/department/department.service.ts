import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const createDepartmentService =
  async (
    payload: {
      code: string;
      name: string;
    }
  ) => {

    const exists =
      await prisma.department.findFirst({
        where: {
          OR: [
            { code: payload.code },
            { name: payload.name },
          ],
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
  async () => {
    return prisma.department.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
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

    return prisma.department.delete({
      where: { id },
    });
  }

// Editand update department
export const updateDepartmentService =
  async (
    id: number,
    payload: {
      code?: string;
      name?: string;
    }
  ) => {

    await getDepartmentByIdService(id);

    const existingDepartment =
      await prisma.department.findFirst({
        where: {
          AND: [
            {
              id: {
                not: id,
              },
            },
            {
              OR: [
                payload.code
                  ? { code: payload.code }
                  : {},
                payload.name
                  ? { name: payload.name }
                  : {},
              ],
            },
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