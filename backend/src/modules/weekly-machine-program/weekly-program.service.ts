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
      include: {
        productItem: {
          include: { billOfMaterials: { include: { rawMaterial: true } } }
        }
      }
    });

    if (!productionOrder) {
      throw new ApiError(404, "Production Order not found");
    }

    const orderTargetQtyCheck = Number(productionOrder.targetQty || 0);
    const orderProducedQtyCheck = Number(productionOrder.producedQty || 0);

    // Auto-correct PO status if it was prematurely set to COMPLETED/DISPATCHED/READY_FOR_DISPATCH but target is not met
    if (["COMPLETED", "DISPATCHED", "READY_FOR_DISPATCH"].includes(productionOrder.status) && orderTargetQtyCheck > 0 && orderProducedQtyCheck < orderTargetQtyCheck) {
      await prisma.productionOrder.update({
        where: { productionOrderId: data.productionOrderId },
        data: { status: "PARTIAL_COMPLETED" }
      });
      (productionOrder as any).status = "PARTIAL_COMPLETED";
    }

    if (productionOrder.status === "COMPLETED" || (productionOrder.status === "DISPATCHED" && orderProducedQtyCheck >= orderTargetQtyCheck) || productionOrder.status === "CANCELLED" || productionOrder.status === "COMPLETED_WITH_SHORTFALL" || productionOrder.status === "CLOSED") {
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

    const schedulableStatuses = [
      "READY_FOR_PLANNING", "WEEKLY_SCHEDULED", "PARTIALLY_PLANNED", "PLANNED", "SCHEDULED",
      "PARTIAL_COMPLETED", "IN_PRODUCTION", "POST_PRODUCTION", "DAILY_PLANNED", "READY_FOR_DISPATCH"
    ];
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

      // Reserve raw materials for this scheduled quantity
      const orderTargetQty = Number(productionOrder.targetQty);
      const plannedQty = Number(data.plannedQty);
      
      if (orderTargetQty > 0 && plannedQty > 0) {
        const rawMaterialsToCheck = Array.isArray((productionOrder as any).draftRawMaterials) && (productionOrder as any).draftRawMaterials.length > 0
          ? ((productionOrder as any).draftRawMaterials as any[])
          : ((productionOrder as any).productItem?.billOfMaterials || []).map((bi: any) => ({
              rawMaterialId: bi.rawMaterialId,
              requiredQty: Number(bi.requiredQuantity) * orderTargetQty,
            }));

        for (const rm of rawMaterialsToCheck) {
          const totalReq = Number(rm.requiredQty);
          const reserveAmount = (totalReq / orderTargetQty) * plannedQty;

          if (reserveAmount > 0 && rm.rawMaterialId) {
            try {
              const stock = await tx.rawMaterial.findUnique({ where: { rawMaterialId: String(rm.rawMaterialId) } });
              if (stock) {
                await tx.rawMaterial.update({
                  where: { rawMaterialId: String(rm.rawMaterialId) },
                  data: {
                    reservedQty: { increment: reserveAmount }
                  }
                });
              }
            } catch (e) {
              console.error("Failed to reserve material", e);
            }
          }
        }
      }

      return created;
    }, { maxWait: 15000, timeout: 30000 });

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
            productItem: true,
            dailyProductionPlans: {
              include: { machine: true, shift: true, hourlyProductions: true }
            }
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
    }, { timeout: 15000, maxWait: 10000 });
  }

  async stopProgramAndCarryForwardInternal(tx: any, weeklyProgramId: string, userId?: string) {
    const existingProgram = await tx.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId }
    });

    if (!existingProgram) return null;

    // ── Step 1: How much was produced in THIS shift for THIS WP ──────────────
    const weekMonday = new Date(existingProgram.weekStartDate);
    const targetDate = new Date(weekMonday);
    targetDate.setUTCDate(weekMonday.getUTCDate() + (existingProgram.dayOfWeek - 1));
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(targetDate.getUTCDate() + 1);

    const shiftAgg = await tx.hourlyProduction.aggregate({
      where: {
        productionOrderId: existingProgram.productionOrderId,
        productionDate: { gte: targetDate, lt: nextDay },
        machineId: existingProgram.machineId || undefined,
        shiftId: existingProgram.shiftId || undefined,
      },
      _sum: { qtyProduced: true }
    });
    const shiftTotalProduced = Number(shiftAgg._sum.qtyProduced || 0);

    // ── Step 2: Complete this WP (set plannedQty to what was actually produced) ──
    const res = await tx.weeklyMachineProgram.update({
      where: { weeklyProgramId },
      data: {
        status: "COMPLETED",
        plannedQty: shiftTotalProduced > 0 ? shiftTotalProduced : existingProgram.plannedQty,
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

    // ── Step 3: Compute PO-level remaining qty ───────────────────────────────
    // 3a. Total produced across ALL hourly logs for this PO (all shifts, all dates)
    const allPoAgg = await tx.hourlyProduction.aggregate({
      where: { productionOrderId: existingProgram.productionOrderId },
      _sum: { qtyProduced: true }
    });
    const totalAllProduced = Number(allPoAgg._sum.qtyProduced || 0);

    // 3b. Total already planned in other ACTIVE (not-yet-completed) WPs
    const activeWpAgg = await tx.weeklyMachineProgram.aggregate({
      where: {
        productionOrderId: existingProgram.productionOrderId,
        status: { in: ["PLANNED", "IN_PROGRESS", "APPROVED", "RELEASED"] },
        weeklyProgramId: { not: weeklyProgramId },
      },
      _sum: { plannedQty: true }
    });
    const alreadyActivePlanned = Number(activeWpAgg._sum.plannedQty || 0);

    // 3c. Fetch PO target and status
    const poData = await tx.productionOrder.findUnique({
      where: { productionOrderId: existingProgram.productionOrderId },
      select: { targetQty: true, status: true }
    });
    const poTargetQty = Number(poData?.targetQty || 0);
    const poIsComplete = ["COMPLETED", "DISPATCHED", "READY_FOR_DISPATCH", "CANCELLED"].includes(poData?.status || "");

    // poRemainingQty = how much the PO still needs, after accounting for all
    // already-produced qty AND qty already scheduled in other active WPs.
    const poRemainingQty = Math.max(0, poTargetQty - totalAllProduced - alreadyActivePlanned);

    // ── Step 4: If PO still needs more, create a carry-forward WP ───────────
    if (poRemainingQty > 0 && !poIsComplete) {
      // Find next shift / day
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

      // Conflict check: if the target machine/shift slot is busy, leave unassigned
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

      // Create carry-forward WP for the FULL PO remaining qty
      const nextWeeklyProgramId = await this.generateNextWeeklyProgramId(tx);
      await tx.weeklyMachineProgram.create({
        data: {
          weeklyProgramId: nextWeeklyProgramId,
          weekStartDate: nextWeekStartDate,
          weekEndDate: new Date(nextWeekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
          machineId: targetMachineId,
          dayOfWeek: nextDayOfWeek,
          shiftId: targetShiftId,
          plannedQty: poRemainingQty,
          status: "PLANNED",
          productionOrderId: existingProgram.productionOrderId,
        }
      });
    }

    await StatusSyncService.syncProductionOrderStatus(tx, existingProgram.productionOrderId, userId);
    return res;
  }

  async delete(weeklyProgramId: string, userId?: string) {
    const weeklyProgram = await this.findById(weeklyProgramId);
    
    // Prevent deletion if production has started or daily planning is done
    const lockedStatuses = ["DAILY_PLANNED", "IN_PROGRESS", "IN_PRODUCTION", "POST_PRODUCTION", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED"];
    if (lockedStatuses.includes(weeklyProgram.status) || lockedStatuses.includes(weeklyProgram.productionOrder?.status || "")) {
      throw new ApiError(400, "Cannot delete weekly program once production has started.");
    }

    await prisma.$transaction(async (tx) => {
      // 1. Un-reserve raw materials
      const productionOrder = await tx.productionOrder.findUnique({
        where: { productionOrderId: weeklyProgram.productionOrderId },
        include: {
          productItem: {
            include: { billOfMaterials: { include: { rawMaterial: true } } }
          }
        }
      });

      if (productionOrder) {
        const orderTargetQty = Number(productionOrder.targetQty);
        const plannedQty = Number(weeklyProgram.plannedQty);
        
        if (orderTargetQty > 0 && plannedQty > 0) {
          const rawMaterialsToCheck = Array.isArray((productionOrder as any).draftRawMaterials) && (productionOrder as any).draftRawMaterials.length > 0
            ? ((productionOrder as any).draftRawMaterials as any[])
            : ((productionOrder as any).productItem?.billOfMaterials || []).map((bi: any) => ({
                rawMaterialId: bi.rawMaterialId,
                requiredQty: Number(bi.requiredQuantity) * orderTargetQty,
              }));

          for (const rm of rawMaterialsToCheck) {
            const totalReq = Number(rm.requiredQty);
            const reserveAmount = (totalReq / orderTargetQty) * plannedQty;

            if (reserveAmount > 0 && rm.rawMaterialId) {
              try {
                const stock = await tx.rawMaterial.findUnique({ where: { rawMaterialId: String(rm.rawMaterialId) } });
                if (stock) {
                  const newReserved = Math.max(0, Number(stock.reservedQty) - reserveAmount);
                  await tx.rawMaterial.update({
                    where: { rawMaterialId: String(rm.rawMaterialId) },
                    data: { reservedQty: newReserved }
                  });
                }
              } catch (e) {
                console.error("Failed to un-reserve material", e);
              }
            }
          }
        }
      }

      // 2. Delete the program
      await tx.weeklyMachineProgram.delete({
        where: { weeklyProgramId }
      });

      // 3. Sync Production Order Status (reverts to READY_FOR_PLANNING if no schedules left)
      await StatusSyncService.syncProductionOrderStatus(tx, weeklyProgram.productionOrderId, userId);
    }, { timeout: 15000, maxWait: 10000 });
  }

  async generateNextWeeklyProgramId(tx: any): Promise<string> {
    const latest = await tx.weeklyMachineProgram.findFirst({
      orderBy: { weeklyProgramId: "desc" },
      select: { weeklyProgramId: true }
    });

    if (!latest || !latest.weeklyProgramId) {
      return "WP0001";
    }

    const match = latest.weeklyProgramId.match(/\d+/);
    if (!match) return "WP0001";

    const nextNumber = parseInt(match[0], 10) + 1;
    return `WP${String(nextNumber).padStart(4, "0")}`;
  }
}

export default new WeeklyProgramService();
