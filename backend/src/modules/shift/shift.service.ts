import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import {
  CreateShiftInput,
  UpdateShiftInput,
} from "./shift.validation";

class ShiftService {
  async create(data: CreateShiftInput) {
    const existing = await prisma.shift.findFirst({
      where: {
        OR: [
          { shiftCode: data.shiftCode },
          { shiftName: data.shiftName },
        ],
      },
    });

    if (existing) {
      throw new ApiError(409, "Shift already exists");
    }

    return prisma.shift.create({
      data: {
        shiftCode: data.shiftCode,
        shiftName: data.shiftName,
        startTime: data.startTime,
        endTime: data.endTime,
        breakDuration: data.breakDuration !== undefined && data.breakDuration !== "" ? Number(data.breakDuration) : null,
        gracePeriod: data.gracePeriod !== undefined && data.gracePeriod !== "" ? Number(data.gracePeriod) : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll() {
    const shifts = await prisma.shift.findMany({
      orderBy: {
        id: "desc",
      },
      include: {
        _count: {
          select: {
            dailyProductionPlans: true,
            WeeklyMachineProgram: true,
            HourlyProduction: true,
            productionWastages: true,
          }
        }
      }
    });

    return shifts.map(shift => {
      const { _count, ...rest } = shift;
      const isAssigned = _count.dailyProductionPlans > 0 || _count.WeeklyMachineProgram > 0 || _count.HourlyProduction > 0 || _count.productionWastages > 0;
      return {
        ...rest,
        isAssigned
      };
    });
  }

  async findById(id: number) {
    const shift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!shift) {
      throw new ApiError(404, "Shift not found");
    }

    return shift;
  }

  async update(id: number, data: UpdateShiftInput) {
    await this.findById(id);

    if (data.shiftCode) {
      const existing = await prisma.shift.findFirst({
        where: {
          shiftCode: data.shiftCode,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ApiError(409, "Shift code already exists");
      }
    }

    return prisma.shift.update({
      where: { id },
      data: {
        shiftCode: data.shiftCode ?? undefined,
        shiftName: data.shiftName ?? undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
        breakDuration: data.breakDuration !== undefined ? (data.breakDuration !== "" ? Number(data.breakDuration) : null) : undefined,
        gracePeriod: data.gracePeriod !== undefined ? (data.gracePeriod !== "" ? Number(data.gracePeriod) : null) : undefined,
        isActive: data.isActive ?? undefined,
      },
    });
  }

  async delete(id: number) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            dailyProductionPlans: true,
            WeeklyMachineProgram: true,
            HourlyProduction: true,
            productionWastages: true,
          }
        }
      }
    });

    if (!shift) {
      throw new ApiError(404, "Shift not found");
    }

    const isAssigned = shift._count.dailyProductionPlans > 0 || shift._count.WeeklyMachineProgram > 0 || shift._count.HourlyProduction > 0 || shift._count.productionWastages > 0;

    if (isAssigned) {
      throw new ApiError(400, "Shift is currently assigned and cannot be deleted");
    }

    return prisma.shift.delete({
      where: { id },
    });
  }

  async getNextShiftId() {
    const lastItem = await prisma.shift.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastItem || !lastItem.shiftCode) {
      return "SHT001";
    }

    const lastId = lastItem.shiftCode;
    const match = lastId.match(/\d+/);
    if (!match) {
      return lastId + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastId.substring(0, lastId.indexOf(numberStr));
    const suffix = lastId.substring(lastId.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }
}

export default new ShiftService();