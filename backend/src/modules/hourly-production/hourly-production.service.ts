import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateHourlyProductionInput, UpdateHourlyProductionInput } from "./hourly-production.validation";
import weeklyProgramService from "../weekly-machine-program/weekly-program.service";
import oeeService from "../oee/oee.service";
import { MachineOperationAssignmentService } from "../machine-operation-assignment/machine-operation-assignment.service";

function getMondayAndDayOfWeek(dateInput: Date | string) {
  let date: Date;
  if (typeof dateInput === "string") {
    const [yyyy, mm, dd] = dateInput.split("-").map(Number);
    date = new Date(Date.UTC(yyyy, mm - 1, dd));
  } else {
    date = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  }

  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const dayOfWeek = day === 0 ? 7 : day; // Monday = 1, ..., Sunday = 7

  // Calculate Monday
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));

  return { monday, dayOfWeek };
}

async function syncProductionOrderQuantities(tx: any, productionOrderId: string) {
  const aggregates = await tx.hourlyProduction.aggregate({
    where: { productionOrderId },
    _sum: {
      qtyProduced: true,
      rejectQty: true,
      scrapQty: true,
    }
  });

  const order = await tx.productionOrder.findUnique({ where: { productionOrderId } });
  let newStatus = order?.status || "IN_PROGRESS";

  if (aggregates._sum.qtyProduced && order?.targetQty && Number(aggregates._sum.qtyProduced) >= Number(order.targetQty)) {
    if (newStatus === "IN_PROGRESS" || newStatus === "IN_PRODUCTION") {
      newStatus = "POST_PRODUCTION";
    } else if (newStatus === "PARTIAL_COMPLETED") {
      newStatus = "READY_FOR_DISPATCH";
    }
  } else if (!["COMPLETED", "POST_PRODUCTION", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED"].includes(newStatus)) {
    newStatus = "IN_PROGRESS";
  }

  await tx.productionOrder.update({
    where: { productionOrderId },
    data: {
      producedQty: aggregates._sum.qtyProduced || 0,
      rejectedQty: aggregates._sum.rejectQty || 0,
      scrapQty: aggregates._sum.scrapQty || 0,
      status: newStatus,
    }
  });
}

class HourlyProductionService {
  async validateHourlyEntry(data: any, excludeId?: bigint) {
    // 1. Verify production order exists
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (!order) {
      throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
    }

    // 2. Entry without Daily Plan
    const { monday, dayOfWeek } = getMondayAndDayOfWeek(data.productionDate);
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    // Daily Production Plan check and validation
    let dailyPlan = null;
    if (data.dailyPlanId) {
      dailyPlan = await prisma.dailyProductionPlan.findUnique({
        where: { dailyPlanId: data.dailyPlanId }
      });
      if (!dailyPlan) {
        throw new ApiError(404, `Daily Production Plan with ID ${data.dailyPlanId} not found`);
      }
    } else {
      // Find a daily plan matching the current logging context
      dailyPlan = await prisma.dailyProductionPlan.findFirst({
        where: {
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          productionOrderId: data.productionOrderId,
        }
      });
    }

    if (dailyPlan) {
      // Rule: Hourly Production can only be entered against an approved or in-progress Daily Plan
      const allowedStatuses = ["APPROVED", "IN_PROGRESS"];
      if (!allowedStatuses.includes(dailyPlan.status.toUpperCase())) {
        throw new ApiError(400, `Hourly Production can only be entered against an approved Daily Plan. Current status: ${dailyPlan.status}`);
      }

      // Resolve assignment and validate Operator
      const assignment = await MachineOperationAssignmentService.resolveAssignment(
        dailyPlan.machineId,
        dailyPlan.shiftId,
        dailyPlan.productionDate
      );
      if (!assignment || !assignment.operators || assignment.operators.length === 0) {
        throw new ApiError(400, "The selected Daily Production Plan does not have an assigned operator.");
      }

      // Resolve selected operator IDs from the daily plan
      const selectedOperatorIds = dailyPlan.selectedOperatorIds
        ? dailyPlan.selectedOperatorIds.split(",").map((id: string) => id.trim()).filter(Boolean)
        : [];

      const assignmentOperatorIds = assignment.operators.map((op: any) => op.id.toString());

      // Check if the provided operatorId is valid (either in the selected daily plan operators, or if none selected, in the weekly assignment)
      const isValidOperator = data.operatorId && (
        selectedOperatorIds.length > 0
          ? selectedOperatorIds.includes(data.operatorId.toString())
          : assignmentOperatorIds.includes(data.operatorId.toString())
      );

      // Auto-assign operatorId if not provided or invalid
      if (!isValidOperator) {
        if (selectedOperatorIds.length > 0) {
          data.operatorId = selectedOperatorIds[0];
        } else {
          data.operatorId = assignment.operators[0].id;
        }
      }

      // Auto-link dailyPlanId in the reference object
      data.dailyPlanId = dailyPlan.dailyPlanId;
    }

    let weeklyProgram = null;
    if (dailyPlan && dailyPlan.weeklyProgramId) {
      weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
        where: { weeklyProgramId: dailyPlan.weeklyProgramId }
      });
    }

    if (!weeklyProgram) {
      weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
        where: {
          machineId: data.machineId,
          shiftId: data.shiftId,
          weekStartDate: monday,
          dayOfWeek: dayOfWeek,
          productionOrderId: data.productionOrderId,
        }
      });
    }

    if (!weeklyProgram) {
      throw new ApiError(400, "Entry without Daily Plan: No weekly machine schedule (Daily Plan) exists for this machine, date, and shift");
    }

    // 3. Entry after Shift Closed
    if (dailyPlan) {
      if (["COMPLETED", "CLOSED", "CANCELLED"].includes(dailyPlan.status.toUpperCase())) {
        throw new ApiError(400, "Entry after Shift Closed: The daily plan schedule has already been closed");
      }
    } else if (weeklyProgram) {
      if (["COMPLETED", "CLOSED"].includes(weeklyProgram.status.toUpperCase())) {
        throw new ApiError(400, "Entry after Shift Closed: The shift schedule has already been closed");
      }
    }

    // 4. Duplicate Hour Entry
    if (Number(data.hourIndex) > 0) {
      const duplicate = await prisma.hourlyProduction.findFirst({
        where: {
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          hourIndex: Number(data.hourIndex),
          ...(excludeId ? { hourlyProductionId: { not: excludeId } } : {})
        }
      });

      if (duplicate) {
        throw new ApiError(409, `Duplicate Hour Entry: An hourly production log already exists for this machine, date, shift, and hour index ${data.hourIndex}`);
      }
    }

    // 5. Future Time Entry (Commented out to allow logging and testing future dates)
    /*
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (prodDate > today) {
      throw new ApiError(400, "Future Time Entry: Cannot enter production for a future date");
    }

    if (prodDate.getTime() === today.getTime()) {
      const [startHour, startMin] = shift.startTime.split(":").map(Number);
      const slotStartTime = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), startHour + (data.hourIndex - 1), startMin, 0, 0));

      if (slotStartTime > now) {
        throw new ApiError(400, "Future Time Entry: Cannot log hourly production for a future time slot");
      }
    }
    */

    // 6. Negative Quantity (handled by Zod but let's be double sure)
    if (data.qtyProduced < 0 || (data.rejectQty && data.rejectQty < 0) || (data.scrapQty && data.scrapQty < 0) || (data.downtime && data.downtime < 0)) {
      throw new ApiError(400, "Quantities and downtime cannot be negative");
    }

    if (data.downtime && Number(data.downtime) > 60) {
      throw new ApiError(400, "Downtime cannot exceed 60 minutes for a single hour slot");
    }

    // 7. Hourly Quantity greater than Remaining Quantity
    const aggregates = await prisma.hourlyProduction.aggregate({
      where: {
        productionDate: prodDate,
        machineId: data.machineId,
        shiftId: data.shiftId,
        productionOrderId: data.productionOrderId,
        ...(excludeId ? { hourlyProductionId: { not: excludeId } } : {})
      },
      _sum: {
        qtyProduced: true
      }
    });

    const alreadyProduced = Number(aggregates._sum.qtyProduced || 0);
    const plannedQty = Number(weeklyProgram.plannedQty);
    const remainingQty = Math.max(0, plannedQty - alreadyProduced);

    // Allow hourly production to exceed planned quantity (overproduction is allowed)
    /*
    if (Number(data.qtyProduced) > remainingQty) {
      throw new ApiError(400, `Hourly Quantity greater than Remaining Quantity: Hourly quantity (${data.qtyProduced}) exceeds the remaining planned quantity (${remainingQty})`);
    }
    */

    return { order, weeklyProgram, dailyPlan };
  }

  async create(data: any) {
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const { weeklyProgram, dailyPlan } = await this.validateHourlyEntry(data);

    return prisma.$transaction(async (tx) => {
      const created = await tx.hourlyProduction.create({
        data: {
          dailyPlanId: dailyPlan?.dailyPlanId ?? null,
          productionOrderId: data.productionOrderId,
          productionDate: prodDate,
          shiftId: data.shiftId,
          machineId: data.machineId,
          hourIndex: data.hourIndex,
          qtyProduced: data.qtyProduced,
          rejectQty: data.rejectQty ?? 0,
          scrapQty: data.scrapQty ?? 0,
          downtime: data.downtime ?? 0,
          remarks: data.remarks ?? null,
          downtimeReason: data.downtimeReason ?? null,
          rejectReason: data.rejectReason ?? null,
          scrapReason: data.scrapReason ?? null,
          operatorId: data.operatorId ?? null,
        },
        include: {
          productionOrder: true,
        },
      });

      // Calculate if this is the last hour of the shift
      const shift = await tx.shift.findUnique({
        where: { shiftCode: data.shiftId }
      });

      let totalHours = 8;
      if (shift && shift.startTime && shift.endTime) {
        const [startH, startM] = shift.startTime.split(":").map(Number);
        const [endH, endM] = shift.endTime.split(":").map(Number);
        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;
        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60;
        }
        totalHours = Math.floor((endMinutes - startMinutes) / 60);
      }

      const isLastHour = Number(data.hourIndex) === totalHours;

      if (isLastHour) {
        // Aggregate total qty produced for this machine, date, and shift
        // Stop current run and carry forward pending qty to next shift if under-produced
        await weeklyProgramService.stopProgramAndCarryForwardInternal(tx, weeklyProgram.weeklyProgramId, data.operatorId ?? undefined);

        const wpNum = parseInt(weeklyProgram.weeklyProgramId.replace(/\D/g, ""), 10) || 1;
        // Automatically log a SYSTEM_STOP
        await tx.hourlyProduction.create({
          data: {
            dailyPlanId: dailyPlan?.dailyPlanId ?? null,
            productionOrderId: data.productionOrderId,
            productionDate: prodDate,
            shiftId: data.shiftId,
            machineId: data.machineId,
            hourIndex: -(10000 + wpNum),
            qtyProduced: 0,
            rejectQty: 0,
            scrapQty: 0,
            downtime: 0,
            remarks: "Shift Hours Completed",
            downtimeReason: "Shift Completed",
            operatorId: "SYSTEM"
          }
        });

        if (dailyPlan?.dailyPlanId && dailyPlan.status !== "COMPLETED") {
          await tx.dailyProductionPlan.update({
            where: { dailyPlanId: dailyPlan.dailyPlanId },
            data: { status: "POST_PRODUCTION" },
          });
        }
      } else {
        // Ensure status is IN_PROGRESS if not the last hour
        if (weeklyProgram.status !== "COMPLETED" && weeklyProgram.status !== "IN_PROGRESS") {
          await tx.weeklyMachineProgram.update({
            where: { weeklyProgramId: weeklyProgram.weeklyProgramId },
            data: { status: "IN_PROGRESS" },
          });
        }
      }

      await syncProductionOrderQuantities(tx, data.productionOrderId);

      // Process inline wastages
      if (data.wastages && Array.isArray(data.wastages) && data.wastages.length > 0) {
        for (const wastage of data.wastages) {
          if (!wastage.targetWastageProductId || !wastage.quantity) continue;

          const latestWastage = await tx.productionWastage.findFirst({
            orderBy: { id: 'desc' }
          });
          const nextId = latestWastage ? Number(latestWastage.id) + 1 : 1;
          const wastageNo = `PW${String(nextId).padStart(4, "0")}`;

          await tx.productionWastage.create({
            data: {
              wastageNo,
              wastageDate: prodDate,
              productionOrderId: data.productionOrderId,
              hourlyProductionId: created.hourlyProductionId,
              machineId: data.machineId,
              shiftId: data.shiftId,
              productId: created.productionOrder?.productItemId ?? BigInt(1),
              targetWastageProductId: wastage.targetWastageProductId,
              storeId: wastage.storeId,
              wastageType: "SCRAP",
              quantity: wastage.quantity,
              uom: wastage.uom || "KG",
              status: "APPROVED",
              createdBy: data.operatorId || "SYSTEM",
              approvedBy: data.operatorId || "SYSTEM",
              approvedAt: new Date(),
              remarks: "Auto-logged from Hourly Production"
            }
          });

          // Increase Stock for Target Wastage Product
          const targetProduct = await tx.rawMaterial.findUnique({
            where: { rawMaterialId: wastage.targetWastageProductId }
          });

          if (targetProduct) {
            await tx.rawMaterial.update({
              where: { rawMaterialId: wastage.targetWastageProductId },
              data: {
                onHandQty: { increment: wastage.quantity },
                lastMovementAt: new Date()
              }
            });

            // Record Stock Ledger Transaction
            await tx.rawMaterialTransaction.create({
              data: {
                storeId: wastage.storeId || targetProduct.storeId || "STORE-001",
                rawMaterialId: wastage.targetWastageProductId,
                txnType: "WASTAGE_RECEIPT",
                qty: wastage.quantity,
                remarks: `Received from Hourly Production Auto-log #${wastageNo}`,
                productionOrderId: data.productionOrderId,
              }
            });

            // Create Stock Adjustment record (so it appears in Stock Adjustment UI)
            const latestSA = await tx.stockAdjustment.findFirst({ orderBy: { id: 'desc' } });
            const saNextId = latestSA ? Number(latestSA.id) + 1 : 1;

            const saRecord = await tx.stockAdjustment.create({
              data: {
                adjustmentNumber: `SA${String(saNextId).padStart(4, "0")}`,
                adjustmentDate: new Date(),
                adjustmentType: "STOCK_INCREASE",
                type: "SYSTEM",
                autoGenerated: true,
                sourceDocument: "WASTAGE_ENTRY",
                sourceDocId: wastageNo,
                productionOrderId: data.productionOrderId,
                status: "APPROVED",
                approvedBy: data.operatorId || "SYSTEM",
                approvedAt: new Date(),
                createdBy: data.operatorId || "SYSTEM",
              }
            });

            // Create Stock Adjustment Item
            await tx.stockAdjustmentItem.create({
              data: {
                stockAdjustmentId: saRecord.id,
                itemType: "WASTAGE",
                rawMaterialId: wastage.targetWastageProductId,
                storeId: wastage.storeId || targetProduct.storeId,
                currentQty: Number(targetProduct.onHandQty ?? 0),
                adjustedQty: Number(targetProduct.onHandQty ?? 0) + Number(wastage.quantity),
                difference: Number(wastage.quantity),
                unitCost: Number(targetProduct.avgCost ?? 0),
              }
            });
          }
        }
      }

      return created;
    }, { timeout: 15000 }).then(async (result) => {
      // Auto-trigger OEE snapshot recalculation after transaction commits
      try {
        await oeeService.recalculateAndSaveSnapshot({
          machineId: data.machineId,
          productionDate: data.productionDate,
          shiftId: data.shiftId,
          dailyPlanId: result.dailyPlanId ?? null,
        });
      } catch (e) {
        // OEE calculation errors should not fail the main operation
        console.error("OEE snapshot recalculation failed:", e);
      }
      return result;
    });
  }

  async findAll(filters?: { machineId?: string; shiftId?: string; productionDate?: string; productionOrderId?: string; search?: string }) {
    const where: any = {};
    if (filters?.machineId) where.machineId = filters.machineId;
    if (filters?.shiftId) where.shiftId = filters.shiftId;
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters?.productionDate) {
      const [yyyy, mm, dd] = filters.productionDate.split("-").map(Number);
      const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));
      where.productionDate = prodDate;
    }
    if (filters?.search) {
      where.OR = [
        { productionOrderId: { contains: filters.search } },
        { machineId: { contains: filters.search } },
        { machine: { machineName: { contains: filters.search } } },
        { productionOrder: { productItem: { productName: { contains: filters.search } } } }
      ];
    }

    const logs = await prisma.hourlyProduction.findMany({
      where,
      include: {
        productionOrder: {
          include: {
            productItem: {
              include: {
                uom: true,
              }
            },
          }
        },
        machine: true,
        shift: true,
      },
      orderBy: [
        { productionDate: "desc" },
        { hourIndex: "asc" }
      ],
    });

    const operatorIds = [...new Set(logs.map(l => l.operatorId).filter(Boolean))].map(id => {
      try { return BigInt(id as string); } catch (e) { return null; }
    }).filter(Boolean) as bigint[];

    let operatorMap = new Map<string, string>();
    if (operatorIds.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: operatorIds } }
      });
      employees.forEach(emp => {
        operatorMap.set(emp.id.toString(), emp.fullName);
      });
    }

    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      const { monday, dayOfWeek } = getMondayAndDayOfWeek(log.productionDate);

      let shiftPlannedQty = 0;
      let weeklyProgramStatus = null;
      let weeklyProgramId = null;

      if (log.dailyPlanId) {
        const dailyPlan = await prisma.dailyProductionPlan.findUnique({
          where: { dailyPlanId: log.dailyPlanId }
        });
        if (dailyPlan) {
          shiftPlannedQty = Number(dailyPlan.plannedQty);
          weeklyProgramStatus = dailyPlan.status;
          weeklyProgramId = dailyPlan.weeklyProgramId;
        }
      }

      if (!shiftPlannedQty) {
        let weeklyProgram = null;
        const hourIdx = Number(log.hourIndex);

        if (hourIdx < 0) {
          // Decode weeklyProgramId from hourIndex
          const absVal = Math.abs(hourIdx);
          const wpNum = absVal >= 10000 ? absVal - 10000 : absVal;
          const decodedWpId = `WP${String(wpNum).padStart(4, '0')}`;
          weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
            where: { weeklyProgramId: decodedWpId }
          });
        }

        // Fallback: search by coordinate, ordering by weeklyProgramId desc to get the newest (active) program first
        if (!weeklyProgram) {
          weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
            where: {
              machineId: log.machineId,
              shiftId: log.shiftId,
              weekStartDate: monday,
              dayOfWeek: dayOfWeek,
              productionOrderId: log.productionOrderId,
            },
            orderBy: {
              weeklyProgramId: "desc"
            }
          });
        }

        if (weeklyProgram) {
          shiftPlannedQty = Number(weeklyProgram.plannedQty);
          weeklyProgramStatus = weeklyProgram.status;
          weeklyProgramId = weeklyProgram.weeklyProgramId;
        }
      }

      // ── Per-hour OEE calculation ───────────────────────────────────────────
      const qtyProduced = Number(log.qtyProduced);
      const rejectQty = Number(log.rejectQty);
      const scrapQty = Number(log.scrapQty);
      const downtimeMinutes = Number(log.downtime);
      const runtimeMinutes = Number((log as any).runtimeMinutes ?? 60);
      const goodQty = Math.max(0, qtyProduced - rejectQty - scrapQty);

      const actualRunTime = Math.max(0, runtimeMinutes - downtimeMinutes);
      const availabilityPct = runtimeMinutes > 0 ? Math.min(100, Math.round((actualRunTime / runtimeMinutes) * 10000) / 100) : 0;
      const qualityPct = qtyProduced > 0 ? Math.min(100, Math.round((goodQty / qtyProduced) * 10000) / 100) : 100;
      const hourlyOEE = Math.round((availabilityPct * 100 * qualityPct) / 10000 * 100) / 100;
      // Performance defaults to 100 per hour (machine-level cycleTime not available per-slot)

      return {
        ...log,
        operatorName: log.operatorId ? (operatorMap.get(log.operatorId) || log.operatorId) : null,
        shiftPlannedQty,
        weeklyProgramStatus,
        weeklyProgramId,
        goodQty,
        availabilityPct,
        qualityPct,
        performancePct: 100,
        hourlyOEE,
      };
    }));

    return enrichedLogs;
  }

  async findById(hourlyProductionId: bigint) {
    const log = await prisma.hourlyProduction.findUnique({
      where: { hourlyProductionId },
      include: {
        productionOrder: {
          include: {
            productItem: {
              include: {
                uom: true,
              }
            }
          }
        },
        machine: true,
        shift: true,
      },
    });

    if (!log) {
      throw new ApiError(404, `Hourly production log with ID ${hourlyProductionId.toString()} not found`);
    }

    return log;
  }

  async update(hourlyProductionId: bigint, data: UpdateHourlyProductionInput) {
    const existing = await this.findById(hourlyProductionId);

    // Merge existing and update data for validation
    const merged = {
      dailyPlanId: data.dailyPlanId !== undefined ? data.dailyPlanId : (existing.dailyPlanId || null),
      productionOrderId: data.productionOrderId ?? existing.productionOrderId,
      productionDate: data.productionDate ?? existing.productionDate.toISOString().split("T")[0],
      shiftId: data.shiftId ?? existing.shiftId,
      machineId: data.machineId ?? existing.machineId,
      hourIndex: data.hourIndex ?? existing.hourIndex,
      qtyProduced: data.qtyProduced ?? Number(existing.qtyProduced),
      rejectQty: data.rejectQty ?? Number(existing.rejectQty),
      scrapQty: data.scrapQty ?? Number(existing.scrapQty),
      downtime: data.downtime ?? Number(existing.downtime),
      remarks: data.remarks ?? existing.remarks,
      downtimeReason: data.downtimeReason ?? existing.downtimeReason,
      rejectReason: data.rejectReason ?? existing.rejectReason,
      scrapReason: data.scrapReason ?? existing.scrapReason,
      operatorId: data.operatorId ?? existing.operatorId,
    };

    await this.validateHourlyEntry(merged, hourlyProductionId);

    const updateData: any = {};
    if (merged.dailyPlanId !== undefined) updateData.dailyPlanId = merged.dailyPlanId ?? null;
    if (data.productionOrderId) updateData.productionOrderId = data.productionOrderId;
    if (data.productionDate) {
      const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
      updateData.productionDate = new Date(Date.UTC(yyyy, mm - 1, dd));
    }
    if (data.shiftId) updateData.shiftId = data.shiftId;
    if (data.machineId) updateData.machineId = data.machineId;
    if (data.hourIndex !== undefined) updateData.hourIndex = data.hourIndex;
    if (data.qtyProduced !== undefined) updateData.qtyProduced = data.qtyProduced;
    if (data.rejectQty !== undefined) updateData.rejectQty = data.rejectQty;
    if (data.scrapQty !== undefined) updateData.scrapQty = data.scrapQty;
    if (data.downtime !== undefined) updateData.downtime = data.downtime;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.downtimeReason !== undefined) updateData.downtimeReason = data.downtimeReason;
    if (data.rejectReason !== undefined) updateData.rejectReason = data.rejectReason;
    if (data.scrapReason !== undefined) updateData.scrapReason = data.scrapReason;
    if (data.operatorId !== undefined) updateData.operatorId = data.operatorId;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.hourlyProduction.update({
        where: { hourlyProductionId },
        data: updateData,
        include: {
          productionOrder: true,
        },
      });

      await syncProductionOrderQuantities(tx, updated.productionOrderId);
      if (existing.productionOrderId !== updated.productionOrderId) {
        await syncProductionOrderQuantities(tx, existing.productionOrderId);
      }
      return updated;
    }, { timeout: 15000 });
  }

  async delete(hourlyProductionId: bigint) {
    const existing = await this.findById(hourlyProductionId);

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.hourlyProduction.delete({
        where: { hourlyProductionId },
      });
      await syncProductionOrderQuantities(tx, existing.productionOrderId);
      return deleted;
    }, { timeout: 15000 });
  }
}

export default new HourlyProductionService();
