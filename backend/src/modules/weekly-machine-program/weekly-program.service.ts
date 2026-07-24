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

    if (data.machineId && data.shiftId && data.weekStartDate && data.dayOfWeek !== undefined) {
      const conflictingProgram = await prisma.weeklyMachineProgram.findFirst({
        where: {
          machineId: data.machineId,
          shiftId: data.shiftId,
          weekStartDate: new Date(data.weekStartDate),
          dayOfWeek: data.dayOfWeek,
          status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED"] }
        }
      });

      if (conflictingProgram) {
        throw new ApiError(409, "This Machine is already scheduled or running on the selected shift for today. Please select a different Machine or Shift.");
      }
    }
    const productionOrder = await prisma.productionOrder.findUnique({
      where: {
        productionOrderId: data.productionOrderId,
      },
    });

    if (!productionOrder) {
      throw new ApiError(404, "Production Order not found");
    }

    if (productionOrder.status === "COMPLETED" || productionOrder.status === "DISPATCHED" || productionOrder.status === "CANCELLED") {
      throw new ApiError(400, `Cannot schedule a Weekly Program for a Production Order that is already ${productionOrder.status.toLowerCase()}`);
    }

    // ✅ STEP 3 RULE: Weekly scheduling only allowed for READY_FOR_PLANNING orders
    // WAITING_FOR_MATERIAL orders must first get their materials before scheduling
    if (productionOrder.status === "WAITING_FOR_MATERIAL") {
      throw new ApiError(
        400,
        `Cannot schedule a Weekly Program: Production Order ${data.productionOrderId} has status WAITING_FOR_MATERIAL. ` +
        `Please ensure all raw materials are available and the order transitions to READY_FOR_PLANNING first.`
      );
    }

    const schedulableStatuses = ["READY_FOR_PLANNING", "WEEKLY_SCHEDULED", "PARTIALLY_PLANNED", "PLANNED", "SCHEDULED"];
    if (!schedulableStatuses.includes(productionOrder.status)) {
      throw new ApiError(
        400,
        `Cannot create Weekly Schedule: Production Order must have status READY_FOR_PLANNING. Current status: ${productionOrder.status}`
      );
    }

    // Validate that the total planned quantity across all weekly schedules (including this one)
    // does not exceed the target quantity of the Production Order.
    const aggregatedSchedules = await prisma.weeklyMachineProgram.aggregate({
      where: {
        productionOrderId: data.productionOrderId,
        status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED", "COMPLETED"] }
      },
      _sum: {
        plannedQty: true
      }
    });

    const alreadyPlannedQty = Number(aggregatedSchedules._sum.plannedQty || 0);
    const orderTargetQty = Number(productionOrder.targetQty);
    const newPlannedQty = Number(data.plannedQty);

    if (alreadyPlannedQty + newPlannedQty > orderTargetQty) {
      throw new ApiError(400, `Cannot schedule Weekly Program: The total planned quantity across all weekly schedules (${alreadyPlannedQty + newPlannedQty} pcs) cannot exceed the Production Order target quantity (${orderTargetQty} pcs). Remaining schedule capacity: ${orderTargetQty - alreadyPlannedQty} pcs.`);
    }

    if (data.machineId) {
      const machine = await prisma.machine.findUnique({
        where: {
          machineId: data.machineId,
        },
      });

      if (!machine) {
        throw new ApiError(404, "Machine not found");
      }
    }

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: {
          shiftCode: data.shiftId,
        },
      });

      if (!shift) {
        throw new ApiError(404, "Shift not found");
      }
    }

    const targetMachineId = data.machineId || null;

    const program = await prisma.$transaction(async (tx) => {
      const created = await tx.weeklyMachineProgram.create({
        data: {
          weeklyProgramId: data.weeklyProgramId,
          productionOrderId: data.productionOrderId,

          weekStartDate: new Date(data.weekStartDate),
          weekEndDate: new Date(data.weekEndDate),

          machineId: targetMachineId,
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

      await StatusSyncService.syncProductionOrderStatus(tx, data.productionOrderId, userId);

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

  // Fetch all programs that are WEEKLY_SCHEDULED or IN_PRODUCTION (pending/active across all weeks)
  async findPending() {
    return prisma.weeklyMachineProgram.findMany({
      where: {
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        // Only show orders that are actually schedulable (exclude WAITING_FOR_MATERIAL)
        productionOrder: {
          status: { notIn: ["WAITING_FOR_MATERIAL", "CANCELLED", "DISPATCHED"] },
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        productionOrder: {
          include: { productItem: true }
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

    const checkMachineId = data.machineId !== undefined ? data.machineId : existingProgram.machineId;
    const checkShiftId = data.shiftId !== undefined ? data.shiftId : existingProgram.shiftId;
    const checkWeekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : existingProgram.weekStartDate;
    const checkDayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existingProgram.dayOfWeek;
    const checkStatus = data.status || existingProgram.status;
    const checkProductionOrderId = data.productionOrderId || existingProgram.productionOrderId;
    const checkPlannedQty = data.plannedQty !== undefined ? Number(data.plannedQty) : Number(existingProgram.plannedQty);

    const productionOrder = await prisma.productionOrder.findUnique({
      where: { productionOrderId: checkProductionOrderId }
    });

    if (!productionOrder) {
      throw new ApiError(404, "Production Order not found");
    }

    // Validate that the updated total planned quantity does not exceed the PO target quantity.
    const aggregatedSchedules = await prisma.weeklyMachineProgram.aggregate({
      where: {
        productionOrderId: checkProductionOrderId,
        weeklyProgramId: { not: weeklyProgramId },
        status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED", "COMPLETED"] }
      },
      _sum: {
        plannedQty: true
      }
    });

    const alreadyPlannedQty = Number(aggregatedSchedules._sum.plannedQty || 0);
    const orderTargetQty = Number(productionOrder.targetQty);

    if (alreadyPlannedQty + checkPlannedQty > orderTargetQty) {
      throw new ApiError(400, `Cannot update Weekly Program: The total planned quantity across all weekly schedules (${alreadyPlannedQty + checkPlannedQty} pcs) cannot exceed the Production Order target quantity (${orderTargetQty} pcs). Remaining schedule capacity: ${orderTargetQty - alreadyPlannedQty} pcs.`);
    }

    // We skip strict validation checks for conflicting schedule and already planned orders
    // to allow splitting POs across multiple schedules. We rely on total quantity validation instead.

    if (checkMachineId && checkShiftId && checkWeekStartDate && checkDayOfWeek !== null) {
      const conflictingProgram = await prisma.weeklyMachineProgram.findFirst({
        where: {
          machineId: checkMachineId,
          shiftId: checkShiftId,
          weekStartDate: checkWeekStartDate,
          dayOfWeek: checkDayOfWeek,
          weeklyProgramId: { not: weeklyProgramId },
          status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED"] }
        }
      });

      if (conflictingProgram) {
        throw new ApiError(409, "This Machine is already scheduled or running on the selected shift for today. Please select a different Machine or Shift.");
      }
    }

    const updatedProgram = await prisma.$transaction(async (tx) => {
      // Determine if program is being stopped/freed
      const isStopping = existingProgram.status === "IN_PROGRESS" &&
        (data.status === "PLANNED" || data.status === "COMPLETED" || data.machineId === null);

      if (isStopping) {
        return await this.stopProgramAndCarryForwardInternal(tx, weeklyProgramId, userId);
      }

      const res = await tx.weeklyMachineProgram.update({
        where: { weeklyProgramId },
        data: updateData,
        include: {
          productionOrder: true,
          machine: true,
          shift: true,
        }
      });
      await StatusSyncService.syncProductionOrderStatus(tx, res.productionOrderId, userId);
      return res;
    });

    return updatedProgram;
  }

  async delete(weeklyProgramId: string, userId?: string) {
    const existingProgram = await this.findById(weeklyProgramId);

    if (existingProgram.productionOrder) {
      const startedStatuses = ["IN_PROGRESS", "IN_PRODUCTION", "POST_PRODUCTION", "COMPLETED", "ON_HOLD", "FG_RECEIVED", "READY_FOR_DISPATCH", "DISPATCHED"];
      if (startedStatuses.includes(existingProgram.productionOrder.status) || startedStatuses.includes(existingProgram.status)) {
        throw new ApiError(400, "Cannot delete schedule because the Production Order has already started or completed production.");
      }
    }

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.weeklyMachineProgram.delete({
        where: { weeklyProgramId },
      });
      await StatusSyncService.syncProductionOrderStatus(tx, existingProgram.productionOrderId, userId);
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
            productItem: {
              include: {
                uom: true,
              }
            }
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
                    machineId: p.machineId || undefined,
                    shiftId: p.shiftId || undefined,
                  },
                  _sum: {
                    qtyProduced: true,
                  },
                });

                const producedQty = Number(aggregate?._sum?.qtyProduced || 0);
                const plannedQty = Number(p.plannedQty);
                const remainingQty = Math.max(0, plannedQty - producedQty);

                return {
                  weeklyProgramId: p.weeklyProgramId,
                  productionOrderId: p.productionOrderId,
                  productCode: p.productionOrder.productItem.productCode,
                  productName: p.productionOrder.productItem.productName,
                  productId: p.productId ? Number(p.productId) : (p.productionOrder?.productItemId ? Number(p.productionOrder.productItemId) : null),
                  uom: (p.productionOrder.productItem.uom?.uomCode?.toLowerCase() === "ea" ? "pcs" : p.productionOrder.productItem.uom?.uomCode) || "pcs",
                  plannedQty,
                  producedQty,
                  remainingQty,
                  status: p.status,
                  priority: p.priority,
                  sequenceNo: p.sequenceNo,
                  poTargetQty: Number(p.productionOrder.targetQty || 0),
                  poProducedQty: Number(p.productionOrder.producedQty || 0),
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

  async stopProgramAndCarryForward(weeklyProgramId: string, userId?: string) {
    return await prisma.$transaction(async (tx) => {
      return await this.stopProgramAndCarryForwardInternal(tx, weeklyProgramId, userId);
    });
  }

  async stopProgramAndCarryForwardInternal(tx: any, weeklyProgramId: string, userId?: string) {
    const existingProgram = await tx.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId }
    });

    if (!existingProgram) return null;

    // Determine the actual production date from the program's week/day fields
    // dayOfWeek: 1=Monday ... 7=Sunday
    const weekMonday = new Date(existingProgram.weekStartDate);
    const targetDate = new Date(weekMonday);
    targetDate.setUTCDate(weekMonday.getUTCDate() + (existingProgram.dayOfWeek - 1));
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(targetDate.getUTCDate() + 1);

    const aggregates = await tx.hourlyProduction.aggregate({
      where: {
        productionOrderId: existingProgram.productionOrderId,
        productionDate: {
          gte: targetDate,
          lt: nextDay
        },
        machineId: existingProgram.machineId || undefined,
        shiftId: existingProgram.shiftId || undefined,
      },
      _sum: {
        qtyProduced: true
      }
    });

    const totalProduced = Number(aggregates._sum.qtyProduced || 0);
    const originalPlannedQty = Number(existingProgram.plannedQty || 0);
    const pendingQty = originalPlannedQty - totalProduced;

    let res;
    if (pendingQty > 0) {
      // 1. Complete original program at actual produced qty
      res = await tx.weeklyMachineProgram.update({
        where: { weeklyProgramId },
        data: {
          status: "COMPLETED",
          plannedQty: totalProduced,
          machineId: null,
          shiftId: null,
          updatedBy: userId,
        },
        include: {
          productionOrder: true,
          machine: true,
          shift: true,
        }
      });

      // 2. Find next shift and day
      const shifts = await tx.shift.findMany({ where: { isActive: true } });
      shifts.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
      const currentIndex = shifts.findIndex((s: any) => s.shiftCode === (existingProgram.shiftId || ""));

      let nextDayOfWeek = existingProgram.dayOfWeek;
      let nextShiftId = existingProgram.shiftId || (shifts[0] ? shifts[0].shiftCode : null);
      let nextWeekStartDate = new Date(existingProgram.weekStartDate);

      if (currentIndex !== -1 && currentIndex < shifts.length - 1) {
        nextShiftId = shifts[currentIndex + 1].shiftCode;
      } else {
        if (shifts.length > 0) nextShiftId = shifts[0].shiftCode;
        nextDayOfWeek = existingProgram.dayOfWeek + 1;
        if (nextDayOfWeek > 7) {
          nextDayOfWeek = 1;
          nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);
        }
      }

      // 3. Conflict Check
      let targetMachineId = existingProgram.machineId;
      let targetShiftId = nextShiftId;

      if (targetMachineId && targetShiftId) {
        const conflictingProgram = await tx.weeklyMachineProgram.findFirst({
          where: {
            machineId: targetMachineId,
            shiftId: targetShiftId,
            weekStartDate: nextWeekStartDate,
            dayOfWeek: nextDayOfWeek,
            status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED"] }
          }
        });
        if (conflictingProgram) {
          targetMachineId = null;
          targetShiftId = null;
        }
      } else {
        targetMachineId = null;
        targetShiftId = null;
      }

      // 4. Create new WeeklyMachineProgram for pending qty
      const nextWeeklyProgramId = await this.generateNextWeeklyProgramId(tx);
      await tx.weeklyMachineProgram.create({
        data: {
          weeklyProgramId: nextWeeklyProgramId,
          weekStartDate: nextWeekStartDate,
          weekEndDate: new Date(nextWeekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
          machineId: targetMachineId,
          dayOfWeek: nextDayOfWeek,
          shiftId: targetShiftId,
          plannedQty: pendingQty,
          status: "PLANNED",
          productionOrderId: existingProgram.productionOrderId,
        }
      });
    } else {
      // If target met/exceeded, complete the run normally
      res = await tx.weeklyMachineProgram.update({
        where: { weeklyProgramId },
        data: {
          status: "COMPLETED",
          machineId: null,
          shiftId: null,
          updatedBy: userId,
        },
        include: {
          productionOrder: true,
          machine: true,
          shift: true,
        }
      });
    }

    await StatusSyncService.syncProductionOrderStatus(tx, existingProgram.productionOrderId, userId);
    return res;
  }

  async generateNextWeeklyProgramId(tx: any): Promise<string> {
    const programs = await tx.weeklyMachineProgram.findMany({
      select: { weeklyProgramId: true }
    });

    let maxNum = 0;
    for (const p of programs) {
      if (p.weeklyProgramId && p.weeklyProgramId.startsWith("WP")) {
        const num = parseInt(p.weeklyProgramId.slice(2), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    return `WP${String(maxNum + 1).padStart(4, '0')}`;
  }
}

export default new WeeklyProgramService();
