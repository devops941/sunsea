import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { CreateMachineInput, UpdateMachineInput } from "./machine.validation";

class MachineService {
  async create(data: CreateMachineInput) {
    const existing = await prisma.machine.findUnique({
      where: { machineId: data.machineId },
    });

    if (existing) {
      throw new ApiError(409, `Machine with ID ${data.machineId} already exists`);
    }

    try {
      return await prisma.machine.create({
        data: {
          machineId: data.machineId,
          machineName: data.machineName,
          technologyType: data.technologyType as any,
          machineType: data.machineType as any,
          manufacturer: data.manufacturer,
          modelNumber: data.modelNumber,
          cycleTime: data.cycleTime,
          operatorId: data.operatorId,
          machineStatus: data.machineStatus as any || "IDLE",
          isActive: data.isActive ?? true,
          description: data.description,
          targetTemperature: data.targetTemperature,
          targetLoadPercent: data.targetLoadPercent,
        },
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

    const [machines, total] = await Promise.all([
      prisma.machine.findMany({
        where,
        orderBy: { machineId: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.machine.count({ where }),
    ]);

    return {
      machines,
      total,
      page,
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

    return machine;
  }

  async update(machineId: string, data: UpdateMachineInput) {
    await this.findById(machineId);

    return prisma.machine.update({
      where: { machineId },
      data,
    });
  }

  async delete(machineId: string) {
    await this.findById(machineId);

    const [weeklyPrograms, productionOrders, assignments, dailyPlans, hourlyProds, oeeSnaps, wastages, shiftRecs] = await Promise.all([
      prisma.weeklyMachineProgram.count({ where: { machineId } }),
      prisma.productionOrder.count({ where: { machineMachineId: machineId } }),
      prisma.machineOperationAssignment.count({ where: { machineId } }),
      prisma.dailyProductionPlan.count({ where: { machineId } }),
      prisma.hourlyProduction.count({ where: { machineId } }),
      prisma.machineOeeSnapshot.count({ where: { machineId } }),
      prisma.productionWastage.count({ where: { machineId } }),
      prisma.productShiftRecord.count({ where: { machineId } }),
    ]);

    if (weeklyPrograms + productionOrders + assignments + dailyPlans + hourlyProds + oeeSnaps + wastages + shiftRecs > 0) {
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
