import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { CreateMachineInput, UpdateMachineInput } from "./machine.validation";

const mapTechType = (val?: string | null) => {
  if (!val) return undefined;
  const u = val.toUpperCase().replace(/\s+/g, "_");
  if (u === "MIXER" || u === "MIXING") return "MIXING";
  if (u === "GRINDING" || u === "GRANULATION") return "GRANULATION";
  return u;
};

class MachineService {
  async create(data: CreateMachineInput & { userId?: string }) {
    const existing = await prisma.machine.findUnique({
      where: { machineId: data.machineId },
    });

    if (existing) {
      throw new ApiError(409, `Machine with ID ${data.machineId} already exists`);
    }

    const { userId, ...machineData } = data as any;
    const initialEditHistory = userId
      ? [{ updatedBy: userId, updatedAt: new Date().toISOString() }]
      : [];

    try {
      return await prisma.machine.create({
        data: {
          machineId: machineData.machineId,
          machineName: machineData.machineName,
          technologyType: mapTechType(machineData.technologyType) as any,
          machineType: machineData.machineType as any,
          manufacturer: machineData.manufacturer,
          modelNumber: machineData.modelNumber,
          cycleTime: machineData.cycleTime,
          operatorId: machineData.operatorId ? machineData.operatorId : null,
          machineStatus: machineData.machineStatus as any || "IDLE",
          isActive: machineData.isActive ?? true,
          description: machineData.description,
          targetTemperature: machineData.targetTemperature,
          targetLoadPercent: machineData.targetLoadPercent,
          createdBy: userId || undefined,
          updatedBy: userId || undefined,
          editHistory: initialEditHistory.length > 0 ? initialEditHistory : undefined,
        } as any,
      });
    } catch (error: any) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2020') ||
        error?.message?.includes('numeric field overflow') ||
        error?.code === '22003'
      ) {
        throw new ApiError(400, "Target temperature value is too large. Maximum allowed is 999.99°C");
      }
      throw error;
    }
  }

  async findAll(params?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 15 } = params || {};

    const where: any = {};
    if (search) {
      where.OR = [
        { machineId: { contains: search, mode: "insensitive" } },
        { machineName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.machine.count({ where }),
      prisma.machine.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(machineId: string) {
    const machine = await prisma.machine.findUnique({
      where: { machineId },
    });

    if (!machine) {
      throw new ApiError(404, `Machine with ID ${machineId} not found`);
    }

    let createdUserName = "Unknown User";
    let createdUserRole = "Unknown Role";
    const machineWithAudit = machine as any;

    if (machineWithAudit.createdBy) {
      if (machineWithAudit.createdBy.startsWith("admin_")) {
        const adminId = BigInt(machineWithAudit.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.fullName || admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        } else {
          createdUserName = machineWithAudit.createdBy;
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: machineWithAudit.createdBy },
          select: { username: true, fullName: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.fullName || user.username;
          createdUserRole = user.role?.name || "User";
        } else {
          createdUserName = machineWithAudit.createdBy;
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    let rawHistory = machineWithAudit.editHistory;
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
      ...machine,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(machineId: string, data: UpdateMachineInput & { userId?: string }) {
    const currentMachine = await prisma.machine.findUnique({
      where: { machineId },
    });

    if (!currentMachine) {
      throw new ApiError(404, `Machine with ID ${machineId} not found`);
    }

    const { userId, ...machineData } = data as any;
    const updatePayload: any = { ...machineData };
    if (machineData.technologyType) {
      updatePayload.technologyType = mapTechType(machineData.technologyType);
    }
    if (machineData.operatorId !== undefined) {
      updatePayload.operatorId = machineData.operatorId ? machineData.operatorId : null;
    }

    let newEditHistory: any[] = [];
    let rawHistory = (currentMachine as any).editHistory;
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
    } else if (currentMachine.createdBy || currentMachine.createdAt) {
      newEditHistory.push({
        updatedBy: currentMachine.createdBy || "System",
        updatedAt: currentMachine.createdAt ? new Date(currentMachine.createdAt).toISOString() : new Date().toISOString(),
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

    return prisma.machine.update({
      where: { machineId },
      data: updatePayload as any,
    });
  }

  async delete(machineId: string) {
    await this.findById(machineId);

    const [weeklyPrograms, productionOrders, dailyPlans, hourlyProds, oeeSnaps, wastages, shiftRecs] = await Promise.all([
      prisma.weeklyMachineProgram.count({ where: { machineId } }),
      prisma.productionOrder.count({ where: { machineMachineId: machineId } }),
      prisma.dailyProductionPlan.count({ where: { machineId } }),
      prisma.hourlyProduction.count({ where: { machineId } }),
      prisma.machineOeeSnapshot.count({ where: { machineId } }),
      prisma.productionWastage.count({ where: { machineId } }),
      prisma.productShiftRecord.count({ where: { machineId } }),
    ]);

    if (weeklyPrograms + productionOrders + dailyPlans + hourlyProds + oeeSnaps + wastages + shiftRecs > 0) {
      throw new ApiError(
        400,
        "Unable to delete this machine because it is linked to other records in the system."
      );
    }

    try {
      return await prisma.machine.delete({
        where: { machineId },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ApiError(
          400,
          "Unable to delete this machine because it is linked to other records in the system."
        );
      }
      throw error;
    }
  }

  async getNextMachineId() {
    const lastItem = await prisma.machine.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastItem) {
      return "MAC001";
    }

    const lastId = lastItem.machineId;
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

export default new MachineService();
