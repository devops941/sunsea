import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import {
  CreateShiftInput,
  UpdateShiftInput,
} from "./shift.validation";
import { logAudit } from "../../utils/auditLog.util";

class ShiftService {
  async create(data: CreateShiftInput & { userId?: string }) {
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

    const { userId, ...shiftData } = data as any;
    const initialEditHistory = userId
      ? [{ updatedBy: userId, updatedAt: new Date().toISOString() }]
      : [];

    const createdShift = await prisma.shift.create({
      data: {
        shiftCode: shiftData.shiftCode,
        shiftName: shiftData.shiftName,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        breakDuration: shiftData.breakDuration !== undefined && shiftData.breakDuration !== "" ? Number(shiftData.breakDuration) : null,
        isActive: shiftData.isActive ?? true,
        createdBy: userId || undefined,
        updatedBy: userId || undefined,
        editHistory: initialEditHistory.length > 0 ? initialEditHistory : undefined,
      } as any,
    });

    await logAudit("Shift", createdShift.shiftCode || createdShift.id.toString(), "CREATE", userId, createdShift.shiftName);
    return createdShift;
  }

  async findAll() {
    const shifts = await prisma.shift.findMany({
      orderBy: {
        id: "asc",
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

    let createdUserName = "Unknown User";
    let createdUserRole = "Unknown Role";
    const shiftWithAudit = shift as any;

    if (shiftWithAudit.createdBy) {
      if (shiftWithAudit.createdBy.startsWith("admin_")) {
        const adminId = BigInt(shiftWithAudit.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.fullName || admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        } else {
          createdUserName = shiftWithAudit.createdBy;
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: shiftWithAudit.createdBy },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.fullName || user.username;
          createdUserRole = user.role?.name || "User";
        } else {
          createdUserName = shiftWithAudit.createdBy;
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    let rawHistory = shiftWithAudit.editHistory;
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
      ...shift,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(id: number, data: UpdateShiftInput & { userId?: string }) {
    const currentShift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!currentShift) {
      throw new ApiError(404, "Shift not found");
    }

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

    const { userId, ...shiftData } = data as any;

    let newEditHistory: any[] = [];
    let rawHistory = (currentShift as any).editHistory;
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
    } else if (currentShift.createdBy || currentShift.createdAt) {
      newEditHistory.push({
        updatedBy: currentShift.createdBy || "System",
        updatedAt: currentShift.createdAt ? new Date(currentShift.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        shiftCode: shiftData.shiftCode ?? undefined,
        shiftName: shiftData.shiftName ?? undefined,
        startTime: shiftData.startTime ?? undefined,
        endTime: shiftData.endTime ?? undefined,
        breakDuration: shiftData.breakDuration !== undefined ? (shiftData.breakDuration !== "" ? Number(shiftData.breakDuration) : null) : undefined,
        isActive: shiftData.isActive ?? undefined,
        updatedBy: userId || undefined,
        editHistory: newEditHistory.length > 0 ? newEditHistory : undefined,
      } as any,
    });

    await logAudit("Shift", updatedShift.shiftCode || updatedShift.id.toString(), "UPDATE", userId, updatedShift.shiftName);
    return updatedShift;
  }

  async delete(id: number, userId?: string) {
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

    const deletedShift = await prisma.shift.delete({
      where: { id },
    });

    await logAudit("Shift", deletedShift.shiftCode || deletedShift.id.toString(), "DELETE", userId, deletedShift.shiftName);
    return deletedShift;
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