import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

export const createDesignationService =
  async (
    payload: {
      code: string;
      name: string;
    }
  ) => {

    const existingDesignation =
      await prisma.designation.findFirst({
        where: {
          OR: [
            { code: payload.code },
            { name: payload.name },
          ],
        },
      });

    if (existingDesignation) {
      throw new ApiError(
        409,
        "Designation already exists"
      );
    }

    return prisma.designation.create({
      data: payload,
    });
  };

export const getAllDesignationsService =
  async (departmentId?: number) => {

    const where: Prisma.DesignationWhereInput =
      departmentId
        ? {
          departmentId,
        }
        : {};

    return prisma.designation.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  };

export const getDesignationByIdService =
  async (
    id: number
  ) => {

    const designation =
      await prisma.designation.findUnique({
        where: { id },
      });

    if (!designation) {
      throw new ApiError(
        404,
        "Designation not found"
      );
    }

    return designation;
  };

export const updateDesignationService =
  async (
    id: number,
    payload: {
      code?: string;
      name?: string;
    }
  ) => {

    await getDesignationByIdService(id);

    const existingDesignation =
      await prisma.designation.findFirst({
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

    if (existingDesignation) {
      throw new ApiError(
        409,
        "Designation already exists"
      );
    }

    return prisma.designation.update({
      where: { id },
      data: payload,
    });
  };

export const deleteDesignationService =
  async (
    id: number
  ) => {

    await getDesignationByIdService(id);

    return prisma.designation.delete({
      where: { id },
    });
  };