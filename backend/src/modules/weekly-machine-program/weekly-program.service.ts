import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateWeeklyProgramInput, UpdateWeeklyProgramInput } from "./weekly-program.validation";
import { StatusSyncService } from "../../utils/status-sync.util";

class WeeklyProgramService {
  async create(data: CreateWeeklyProgramInput, userId?: string) {
    const existingId = await prisma.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId: data.weeklyProgramId },
    });

    if (existingId) {
      throw new ApiError(409, `Weekly Program with ID ${data.weeklyProgramId} already exists`);
    }

    // Find the max sequenceNo for this shift to avoid unique constraint violations
    const existingProgramsInShift = await prisma.weeklyMachineProgram.findMany({
      where: {
        machineId: data.machineId,
        shiftId: data.shiftId,
        weekStartDate: new Date(data.weekStartDate),
        dayOfWeek: data.dayOfWeek,
      },
      orderBy: { sequenceNo: 'desc' },
      take: 1
    });

    const nextSequenceNo = existingProgramsInShift.length > 0 
      ? existingProgramsInShift[0].sequenceNo + 1 
      : (data.sequenceNo || 1);

    // We allow multiple schedules for the same PO (auto-splitting across shifts)
    // so we skip the strict "already planned" validation here. We rely on total quantity validation instead.


    const productionOrder = await prisma.productionOrder.findUnique({
      where: {
        productionOrderId: data.productionOrderId,
      },
    });

    if (!productionOrder) {
      throw new ApiError(404, "Production Order not found");
    }

    const machine = await prisma.machine.findUnique({
      where: {
        machineId: data.machineId,
      },
    });

    if (!machine) {
      throw new ApiError(404, "Machine not found");
    } const shift = await prisma.shift.findUnique({
      where: {
        shiftCode: data.shiftId,
      },
    });

    if (!shift) {
      throw new ApiError(404, "Shift not found");
    }

    const program = await prisma.$transaction(async (tx) => {
      const created = await tx.weeklyMachineProgram.create({
        data: {
          weeklyProgramId: data.weeklyProgramId,
          productionOrderId: data.productionOrderId,

          weekStartDate: new Date(data.weekStartDate),
          weekEndDate: new Date(data.weekEndDate),

          machineId: data.machineId,
          shiftId: data.shiftId,
          dayOfWeek: data.dayOfWeek,

          plannedQty: data.plannedQty,
          plannedHours: data.plannedHours,
          setupHours: data.setupHours,

          sequenceNo: nextSequenceNo,

          priority: data.priority ?? "MEDIUM",
          status: data.status ?? "PLANNED",

          remarks: data.remarks,

          createdBy: userId,
        },
        include: {
          productionOrder: true,
          machine: true,
          shift: true,
        }
      });
      
      await StatusSyncService.syncProductionOrderStatus(tx, data.productionOrderId);
      
      return created;
    });
    
    return program;
  }

  async findAll(filters?: { machineId?: string, weekStartDate?: string, search?: string }) {
    const where: any = {};
    if (filters?.machineId) {
      where.machineId = filters.machineId;
    }
    if (filters?.weekStartDate) {
      where.weekStartDate = {
        gte: new Date(filters.weekStartDate),
        lt: new Date(new Date(filters.weekStartDate).getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days ahead
      };
    }
    if (filters?.search) {
      where.OR = [
        { weeklyProgramId: { contains: filters.search, mode: 'insensitive' } },
        { status: { contains: filters.search, mode: 'insensitive' } },
        { machine: { machineName: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }

    return prisma.weeklyMachineProgram.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        productionOrder: {
          include: {
            productItem: true
          }
        },
        machine: true,
        shift: true,
      }
    });
  }

  async findById(weeklyProgramId: string) {
    const weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId },
      include: {
        productionOrder: {
          include: {
            productItem: true
          }
        },
        machine: true,
        shift: true,
      }
    });

    if (!weeklyProgram) {
      throw new ApiError(404, `Weekly Program with ID ${weeklyProgramId} not found`);
    }

    return weeklyProgram;
  }

  async update(weeklyProgramId: string, data: UpdateWeeklyProgramInput, userId?: string) {
    const existingProgram = await this.findById(weeklyProgramId);

    const updateData: any = { ...data, updatedBy: userId };

    if (data.weekStartDate) updateData.weekStartDate = new Date(data.weekStartDate);
    if (data.weekEndDate) updateData.weekEndDate = new Date(data.weekEndDate);

    const checkMachineId = data.machineId || existingProgram.machineId;
    const checkShiftId = data.shiftId || existingProgram.shiftId;
    const checkWeekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : existingProgram.weekStartDate;
    const checkDayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existingProgram.dayOfWeek;
    const checkStatus = data.status || existingProgram.status;
    const checkProductionOrderId = data.productionOrderId || existingProgram.productionOrderId;

    // We skip strict validation checks for conflicting schedule and already planned orders
    // to allow splitting POs across multiple schedules. We rely on total quantity validation instead.

    const updatedProgram = await prisma.$transaction(async (tx) => {
      const res = await tx.weeklyMachineProgram.update({
        where: { weeklyProgramId },
        data: updateData,
        include: {
          productionOrder: true,
          machine: true,
          shift: true,
        }
      });
      await StatusSyncService.syncProductionOrderStatus(tx, res.productionOrderId);
      return res;
    });
    
    return updatedProgram;
  }

  async delete(weeklyProgramId: string) {
    const existingProgram = await this.findById(weeklyProgramId);

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.weeklyMachineProgram.delete({
        where: { weeklyProgramId },
      });
      await StatusSyncService.syncProductionOrderStatus(tx, existingProgram.productionOrderId);
      return deleted;
    });
  }

  async getNextWeeklyProgramId() {
    const lastItem = await prisma.weeklyMachineProgram.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastItem) {
      return "WP0001";
    }

    const lastId = lastItem.weeklyProgramId;
    const match = lastId.match(/\d+/);
    if (!match) {
      return lastId + "0001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastId.substring(0, lastId.indexOf(numberStr));
    const suffix = lastId.substring(lastId.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }

  async getDailyPlanningData(machineId: string, weekStartDate: string) {
    if (!machineId || !weekStartDate) {
      throw new ApiError(400, "machineId and weekStartDate are required");
    }

    // Parse YYYY-MM-DD precisely as UTC midnight to avoid local timezone shifts
    const [yyyy, mm, dd] = weekStartDate.split('-').map(Number);
    const startOfSelectedWeek = new Date(Date.UTC(yyyy, mm - 1, dd));

    // Get all programs for this machine and week
    const programs = await prisma.weeklyMachineProgram.findMany({
      where: {
        machineId,
        weekStartDate: {
          gte: startOfSelectedWeek,
          lt: new Date(startOfSelectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
        },
      },
      include: {
        productionOrder: {
          include: {
            productItem: true,
          },
        },
        shift: true,
      },
      orderBy: {
        sequenceNo: "asc",
      },
    });

    // Get all active shifts
    const activeShifts = await prisma.shift.findMany({
      where: { isActive: true },
      orderBy: { startTime: "asc" },
    });

    // We will generate the 7 days (Monday to Sunday)
    const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    const days = await Promise.all(
      DAY_NAMES.map(async (dayName, index) => {
        const dayOfWeek = index + 1; // 1 = Monday, ..., 7 = Sunday
        const dateForDay = new Date(Date.UTC(yyyy, mm - 1, dd + index));
        const dateString = dateForDay.toISOString().split("T")[0];

        const dayShifts = await Promise.all(
          activeShifts.map(async (shift) => {
            // Find programs for this day and shift
            const filteredPrograms = programs.filter(
              (p) => p.dayOfWeek === dayOfWeek && p.shiftId === shift.shiftCode
            );

            const programDetails = await Promise.all(
              filteredPrograms.map(async (p) => {
                // Fetch the sum of qtyProduced from hourlyProduction for this date and shift
                const aggregate = await prisma.hourlyProduction.aggregate({
                  where: {
                    productionOrderId: p.productionOrderId,
                    productionDate: dateForDay,
                    machineId: p.machineId,
                    shiftId: p.shiftId,
                  },
                  _sum: {
                    qtyProduced: true,
                  },
                });

                const producedQty = Number(aggregate._sum.qtyProduced || 0);
                const plannedQty = Number(p.plannedQty);
                const remainingQty = Math.max(0, plannedQty - producedQty);

                return {
                  weeklyProgramId: p.weeklyProgramId,
                  productionOrderId: p.productionOrderId,
                  productCode: p.productionOrder.productItem.productCode,
                  productName: p.productionOrder.productItem.productName,
                  plannedQty,
                  producedQty,
                  remainingQty,
                  status: p.status,
                  priority: p.priority,
                  sequenceNo: p.sequenceNo,
                };
              })
            );

            return {
              shiftId: shift.shiftCode,
              shiftName: shift.shiftName,
              startTime: shift.startTime,
              endTime: shift.endTime,
              programs: programDetails,
            };
          })
        );

        return {
          dayOfWeek,
          dayName,
          date: dateString,
          shifts: dayShifts,
        };
      })
    );

    return {
      machineId,
      weekStartDate: weekStartDate,
      shifts: activeShifts.map((s) => ({
        shiftId: s.shiftCode,
        shiftName: s.shiftName,
      })),
      days,
    };
  }
}

export default new WeeklyProgramService();
