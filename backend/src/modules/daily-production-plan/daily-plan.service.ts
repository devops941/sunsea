import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";
import dailyPlanRepository from "./daily-plan.repository";
import { CreateDailyPlanInput, UpdateDailyPlanInput, BulkCreateDailyPlanInput } from "./daily-plan.validation";
import { StatusSyncService } from "../../utils/status-sync.util";
import { StockAdjustmentService } from "../stock-adjustment/stock-adjustment.service";

/** Extract the primary (first) UOM from a comma-separated string like "kg,g,mt" → "kg" */
const primaryUom = (raw: string | null | undefined, fallback = "KG"): string => {
  if (!raw) return fallback;
  return raw.split(",")[0].trim() || fallback;
};

class DailyPlanService {
  async generateNextDailyPlanId(tx?: any): Promise<string> {
    const client = tx || prisma;
    const latest = await client.dailyProductionPlan.findFirst({
      orderBy: { dailyPlanId: "desc" },
      select: { dailyPlanId: true },
    });

    if (!latest || !latest.dailyPlanId) {
      return "DP0001";
    }

    const match = latest.dailyPlanId.match(/\d+/);
    if (!match) return "DP0001";

    const nextNumber = parseInt(match[0], 10) + 1;
    return `DP${String(nextNumber).padStart(4, "0")}`;
  }

  async create(data: CreateDailyPlanInput, userId?: string) {
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    // 1. Validation: Weekly Plan (optional — auto-created if not provided)
    let resolvedWeeklyProgramId = data.weeklyProgramId ?? null;
    if (resolvedWeeklyProgramId) {
      const weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
        where: { weeklyProgramId: resolvedWeeklyProgramId },
      });
      if (!weeklyProgram) {
        throw new ApiError(404, `Weekly Program with ID ${resolvedWeeklyProgramId} not found`);
      }
    }

    // 2. Validation: Production Order must exist
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (!productionOrder) {
      throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
    }
    const targetQty = Number(productionOrder.targetQty || 0);
    const producedQty = Number(productionOrder.producedQty || 0);
    if (targetQty > 0 && producedQty >= targetQty) {
      throw new ApiError(
        400,
        `Cannot create Daily Plan: Target quantity of ${targetQty} pcs has already been fully produced.`
      );
    }

    // ✅ STEP 4 RULE: Daily Planning only allowed for WEEKLY_SCHEDULED orders
    // Also allow legacy SCHEDULED and DAILY_PLANNED (for re-planning an existing day)
    const dailyPlanAllowedStatuses = [
      "WEEKLY_SCHEDULED",
      "SCHEDULED",       // legacy alias
      "DAILY_PLANNED",   // already daily planned, adding another shift
      "IN_PROGRESS",     // allow creating plans for orders currently in progress (e.g. next shift/day)
      "POST_PRODUCTION", // allow carrying forward production even if previous shifts are in post-production
      "PARTIAL_COMPLETED", // allow planning remaining quantity for partially completed orders
      "READY_FOR_DISPATCH", // allow planning remaining quantity if target is not yet fully met
      "DISPATCHED", // allow if accidentally fully dispatched but target not met
    ];
    if (!dailyPlanAllowedStatuses.includes(productionOrder.status)) {
      throw new ApiError(
        400,
        `Cannot create Daily Plan: Production Order status must be schedulable. Current status: ${productionOrder.status}. ` +
        `Please ensure the Production Order is active.`
      );
    }

    // Warn if PO is still WAITING_FOR_MATERIAL — daily plan can still be created but operator is alerted
    const materialWarning = productionOrder.status === "WAITING_FOR_MATERIAL"
      ? `Warning: Production Order ${data.productionOrderId} is in WAITING_FOR_MATERIAL status. Raw materials may be insufficient. Please confirm material availability before starting production.`
      : null;

    // 3. Validation: Machine must exist
    const machine = await prisma.machine.findUnique({
      where: { machineId: data.machineId },
    });
    if (!machine) {
      throw new ApiError(404, `Machine with ID ${data.machineId} not found`);
    }

    // Machine validation
    if (!machine.isActive) {
      throw new ApiError(400, `Machine ${machine.machineName} (${data.machineId}) is currently inactive and cannot be planned`);
    }

    // Validate Machine operational status — cannot plan on a broken/under-maintenance machine
    const blockedMachineStatuses = ["BREAKDOWN", "MAINTENANCE"];
    if (machine.machineStatus && blockedMachineStatuses.includes(machine.machineStatus)) {
      throw new ApiError(
        400,
        `Machine ${machine.machineName} (${data.machineId}) is currently under ${machine.machineStatus} and cannot be scheduled for production. Please resolve the machine issue first.`
      );
    }

    // 5. Validation: Planned quantity must be greater than zero
    if (data.plannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    // 6. Carry-forward guard: a source plan can only be carried forward ONCE
    if (data.carryForwardFromPlanId) {
      const sourcePlan = await prisma.dailyProductionPlan.findUnique({
        where: { dailyPlanId: data.carryForwardFromPlanId },
        include: { carryForwardTo: { select: { dailyPlanId: true } } },
      });
      if (!sourcePlan) {
        throw new ApiError(404, `Source plan ${data.carryForwardFromPlanId} not found`);
      }
      if (sourcePlan.carryForwardTo && sourcePlan.carryForwardTo.length > 0) {
        throw new ApiError(409, `Plan ${data.carryForwardFromPlanId} has already been carried forward. Each plan can only be carried forward once.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      // 7. Validation: Machine must not already be planned for the same date, shift, and PO
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, data.machineId, data.shiftId, data.productionOrderId, undefined, tx);
      if (isAlreadyPlanned) {
        throw new ApiError(409, `Machine ${data.machineId} is already scheduled with production order ${data.productionOrderId} on shift ${data.shiftId} for date ${data.productionDate}`);
      }

      // Cross-PO double-booking check: machine cannot be assigned to two DIFFERENT production orders on the same shift+date
      const crossPoConflict = await tx.dailyProductionPlan.count({
        where: {
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          productionOrderId: { not: data.productionOrderId },
          status: { notIn: ["CANCELLED", "COMPLETED", "STOPPED", "SHORT_CLOSED"] },
        },
      });
      if (crossPoConflict > 0) {
        throw new ApiError(
          409,
          `Machine ${data.machineId} is already assigned to another Production Order on shift ${data.shiftId} for ${data.productionDate}. A machine can only run one Production Order per shift.`
        );
      }

      const nextId = await this.generateNextDailyPlanId(tx);

      const created = await dailyPlanRepository.create(
        {
          dailyPlanId: nextId,
          weeklyProgramId: resolvedWeeklyProgramId,
          productionOrderId: data.productionOrderId,
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          plannedQty: data.plannedQty,
          plannedHours: data.plannedHours ?? null,
          priority: data.priority ?? "MEDIUM",
          status: data.status ?? "DRAFT",
          remarks: data.remarks ?? null,
          carryForwardFromPlanId: data.carryForwardFromPlanId ?? null,
          selectedOperatorIds: data.selectedOperatorIds ?? null,
          createdBy: userId,
        },
        tx
      );

      // Sync operators to junction table (DailyPlanOperator) for proper referential integrity
      if (data.selectedOperatorIds) {
        const opIds = data.selectedOperatorIds.split(",").map((id: string) => id.trim()).filter((id: string) => /^\d+$/.test(id));
        for (const opId of opIds) {
          await tx.dailyPlanOperator.upsert({
            where: { dailyPlanId_employeeId: { dailyPlanId: nextId, employeeId: BigInt(opId) } },
            create: { dailyPlanId: nextId, employeeId: BigInt(opId), createdBy: userId },
            update: {},
          }).catch(() => {}); // skip if employee doesn't exist
        }
      }

      // ✅ STEP 4: Transition Production Order to DAILY_PLANNED after first daily plan created
      if (productionOrder.status === "WEEKLY_SCHEDULED" || productionOrder.status === "SCHEDULED") {
        await tx.productionOrder.update({
          where: { productionOrderId: data.productionOrderId },
          data: { status: "DAILY_PLANNED" },
        });
        await StatusSyncService.logHistory(
          tx,
          data.productionOrderId,
          productionOrder.status,
          "DAILY_PLANNED",
          userId,
          `Daily production plan ${nextId} created for ${data.productionDate}`,
          "DAILY_PLAN_CREATED"
        );
      }

      const operators = await this.filterOperators([], created.selectedOperatorIds);
      return {
        ...created,
        operators,
        shiftIncharge: null,
        materialWarning,
      };
    }, { timeout: 15000, maxWait: 10000 });
  }

  async update(dailyPlanId: string, data: UpdateDailyPlanInput, userId?: string) {
    const existingPlan = await dailyPlanRepository.findById(dailyPlanId);
    if (!existingPlan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    const checkWeeklyProgramId = data.weeklyProgramId || existingPlan.weeklyProgramId;
    const checkProductionOrderId = data.productionOrderId || existingPlan.productionOrderId;
    const checkMachineId = data.machineId || existingPlan.machineId;
    const checkShiftId = data.shiftId || existingPlan.shiftId;
    const checkPlannedQty = data.plannedQty !== undefined ? data.plannedQty : Number(existingPlan.plannedQty);

    let prodDate = existingPlan.productionDate;
    if (data.productionDate) {
      const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
      prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));
    }

    // 1. Verify Weekly Plan exists
    const weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId: checkWeeklyProgramId },
    });
    if (!weeklyProgram) {
      throw new ApiError(404, `Weekly Program with ID ${checkWeeklyProgramId} not found`);
    }

    // 2. Verify Production Order exists
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { productionOrderId: checkProductionOrderId },
    });
    if (!productionOrder) {
      throw new ApiError(404, `Production Order with ID ${checkProductionOrderId} not found`);
    }

    // 3. Verify Machine exists
    const machine = await prisma.machine.findUnique({
      where: { machineId: checkMachineId },
    });
    if (!machine) {
      throw new ApiError(404, `Machine with ID ${checkMachineId} not found`);
    }

    // Validate Machine Active status
    if (!machine.isActive) {
      throw new ApiError(400, `Machine ${machine.machineName} (${checkMachineId}) is currently inactive and cannot be planned`);
    }

    // Validate Machine operational status — cannot plan on a broken/under-maintenance machine
    const blockedMachineStatuses = ["BREAKDOWN", "MAINTENANCE"];
    if (machine.machineStatus && blockedMachineStatuses.includes(machine.machineStatus)) {
      throw new ApiError(
        400,
        `Machine ${machine.machineName} (${checkMachineId}) is currently under ${machine.machineStatus} and cannot be scheduled for production. Please resolve the machine issue first.`
      );
    }

    // 5. Verify quantity > 0
    if (checkPlannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    return prisma.$transaction(async (tx) => {
      // 6. Verify machine is not already planned on this date, shift & PO (excluding self)
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, checkMachineId, checkShiftId, checkProductionOrderId, dailyPlanId, tx);
      if (isAlreadyPlanned) {
        throw new ApiError(
          409,
          `Machine ${checkMachineId} is already scheduled with production order ${checkProductionOrderId} on shift ${checkShiftId} for date ${prodDate.toISOString().split("T")[0]}`
        );
      }

      // Cross-PO double-booking check on update: machine cannot switch to a slot occupied by another PO
      const crossPoConflict = await tx.dailyProductionPlan.count({
        where: {
          productionDate: prodDate,
          machineId: checkMachineId,
          shiftId: checkShiftId,
          productionOrderId: { not: checkProductionOrderId },
          dailyPlanId: { not: dailyPlanId },
          status: { notIn: ["CANCELLED", "COMPLETED", "STOPPED", "SHORT_CLOSED"] },
        },
      });
      if (crossPoConflict > 0) {
        throw new ApiError(
          409,
          `Machine ${checkMachineId} is already assigned to another Production Order on shift ${checkShiftId} for ${prodDate.toISOString().split("T")[0]}. A machine can only run one Production Order per shift.`
        );
      }

      // ✅ STEP 5 GATE: If transitioning to IN_PROGRESS, production order must be DAILY_PLANNED
      // The actual stock deduction happens via the /start-production API — not here.
      // This just validates the gate and transitions the daily plan status.
      if (
        data.status === "IN_PROGRESS" &&
        existingPlan.status !== "IN_PROGRESS"
      ) {
        if (!["DAILY_PLANNED", "IN_PRODUCTION", "IN_PROGRESS", "WEEKLY_SCHEDULED", "MATERIAL_ISSUED", "POST_PRODUCTION", "PARTIAL_COMPLETED", "DISPATCHED"].includes(productionOrder.status)) {
          throw new ApiError(
            400,
            `Daily Plan cannot be started because the Production Order status is "${productionOrder.status}". ` +
            `Please ensure the production order is active and use the Start Production action.`
          );
        }
      }

      // Formulate update fields
      const updateData: any = {
        weeklyProgramId: checkWeeklyProgramId,
        productionOrderId: checkProductionOrderId,
        productionDate: prodDate,
        machineId: checkMachineId,
        shiftId: checkShiftId,
        plannedQty: checkPlannedQty,
        plannedHours: data.plannedHours !== undefined ? data.plannedHours : existingPlan.plannedHours,
        priority: data.priority || existingPlan.priority,
        status: data.status === "NEXT_STEP" ? "IN_PROGRESS" : (data.status || existingPlan.status),
        remarks: data.remarks !== undefined ? data.remarks : existingPlan.remarks,
        selectedOperatorIds: data.selectedOperatorIds !== undefined ? data.selectedOperatorIds : existingPlan.selectedOperatorIds,
        updatedBy: userId,
      };

      // Handle permanent stop (Short-close / Stop Production Plan)
      const isPermanentStop = Boolean(
        data.shortClosePO ||
        (data.remarks && data.remarks.includes("Permanently Stopped"))
      );

      if (isPermanentStop) {
        updateData.status = "STOPPED";
        const productionOrderFull = await tx.productionOrder.findUnique({
          where: { productionOrderId: checkProductionOrderId },
          include: { productItem: { include: { productionSteps: { orderBy: { stepOrder: "asc" } } } } },
        });

        if (productionOrderFull) {
          // 1. Close this weekly program
          if (checkWeeklyProgramId) {
            await tx.weeklyMachineProgram.update({
              where: { weeklyProgramId: checkWeeklyProgramId },
              data: { status: "COMPLETED" },
            }).catch(() => {});
          }

          // 2. Compute accurate net produced quantity from hourly productions
          const hpAgg = await tx.hourlyProduction.aggregate({
            where: { productionOrderId: checkProductionOrderId },
            _sum: { totalQtyProduced: true, totalRejectQty: true },
          });
          const netProduced = Math.max(
            0,
            Number(hpAgg._sum.totalQtyProduced || 0) - Number(hpAgg._sum.totalRejectQty || 0)
          );
          const finalProduced = netProduced > 0 ? netProduced : Number(productionOrderFull.producedQty || 0);
          const targetQty = Number(productionOrderFull.targetQty || 0);
          const permanentStopStatus = targetQty > 0 && finalProduced >= targetQty
            ? "READY_FOR_DISPATCH"
            : "COMPLETED_WITH_SHORTFALL";

          // Extract clean stop reason
          let stopReasonOnly = "No reason provided";
          if (data.remarks) {
            const parts = data.remarks.split("Stopped:");
            if (parts.length > 1) {
              stopReasonOnly = parts[parts.length - 1].trim();
            } else {
              const parts2 = data.remarks.split(":");
              stopReasonOnly = parts2.length > 1 ? parts2[parts2.length - 1].trim() : data.remarks.trim();
            }
          }

          // Update PO status, producedQty, remarks
          await tx.productionOrder.update({
            where: { productionOrderId: checkProductionOrderId },
            data: {
              status: permanentStopStatus,
              producedQty: finalProduced,
              remarks: data.remarks || `Permanently Stopped: ${stopReasonOnly}`,
            },
          });

          // 3. Cascade clean other daily plans for this PO:
          // Unstarted future shifts (0 production logs) are completely removed from DB & board
          const otherActiveDPs = await tx.dailyProductionPlan.findMany({
            where: {
              productionOrderId: checkProductionOrderId,
              dailyPlanId: { not: dailyPlanId },
            },
            include: {
              hourlyProductions: true,
            },
          });

          for (const dp of otherActiveDPs) {
            const dpProduced = dp.hourlyProductions.reduce(
              (sum: number, hp: any) => sum + Number(hp.totalQtyProduced || 0),
              0
            );
            const hasProduction = dp.hourlyProductions.length > 0 || dpProduced > 0;
            if (!hasProduction) {
              // Delete unstarted daily plan so slots are freed on board & PO details
              await tx.dailyPlanOperator.deleteMany({ where: { dailyPlanId: dp.dailyPlanId } });
              await tx.hourlyProduction.deleteMany({ where: { dailyPlanId: dp.dailyPlanId } });
              await tx.dailyProductionPlan.delete({ where: { dailyPlanId: dp.dailyPlanId } });
              if (dp.weeklyProgramId) {
                const siblingCount = await tx.dailyProductionPlan.count({
                  where: { weeklyProgramId: dp.weeklyProgramId },
                });
                if (siblingCount === 0) {
                  await tx.weeklyMachineProgram.delete({
                    where: { weeklyProgramId: dp.weeklyProgramId },
                  }).catch(() => {});
                }
              }
            } else {
              // Shift had production activity
              await tx.dailyProductionPlan.update({
                where: { dailyPlanId: dp.dailyPlanId },
                data: { status: "STOPPED" },
              });
              if (dp.weeklyProgramId) {
                await tx.weeklyMachineProgram.update({
                  where: { weeklyProgramId: dp.weeklyProgramId },
                  data: { status: "COMPLETED" },
                }).catch(() => {});
              }
            }
          }

          // Audit log
          const cancelledQty = targetQty > finalProduced ? targetQty - finalProduced : 0;
          await StatusSyncService.logHistory(
            tx, checkProductionOrderId, productionOrderFull.status, permanentStopStatus, userId,
            data.remarks || `Production force-stopped (Permanent Stop). All unstarted planned shifts removed.`, "PERMANENT_STOP",
            {
              stopReason: stopReasonOnly,
              stopAction: "PERMANENT_STOP",
              producedQuantity: finalProduced,
              cancelledQuantity: cancelledQty,
              user: userId,
              dateTime: new Date().toISOString()
            }
          );
        }
      } else if (
        (data.status === "COMPLETED" || data.status === "NEXT_STEP" || data.status === "POST_PRODUCTION")
      ) {
        const productionOrderFull = await tx.productionOrder.findUnique({
          where: { productionOrderId: checkProductionOrderId },
          include: { productItem: { include: { productionSteps: { orderBy: { stepOrder: "asc" } } } } },
        });

        if (productionOrderFull) {
          const customSteps = productionOrderFull.productItem?.productionSteps || [];
          const totalCustomStepsCount = customSteps.length;
          
          if (data.status === "POST_PRODUCTION") {
            // First time entering POST_PRODUCTION
            if (existingPlan.status !== "POST_PRODUCTION") {
              const firstStepName = totalCustomStepsCount > 0 ? customSteps[0].stepKey : "Post Production";
              
              updateData.currentStepIndex = 1;
              updateData.currentProductionStep = firstStepName;
              updateData.status = "POST_PRODUCTION";
            }

            if (productionOrderFull.status !== "POST_PRODUCTION" && productionOrderFull.status !== "READY_FOR_DISPATCH" && productionOrderFull.status !== "COMPLETED" && productionOrderFull.status !== "PARTIAL_COMPLETED" && productionOrderFull.status !== "COMPLETED_WITH_SHORTFALL" && productionOrderFull.status !== "CLOSED") {
              await tx.productionOrder.update({
                where: { productionOrderId: checkProductionOrderId },
                data: { status: "POST_PRODUCTION" },
              });
              await StatusSyncService.logHistory(
                tx, checkProductionOrderId, productionOrderFull.status, "POST_PRODUCTION", userId,
                "Production completed. Entering post-production phase.", "POST_PRODUCTION_START"
              );
            }
          }
          else if (data.status === "NEXT_STEP" && existingPlan.status === "POST_PRODUCTION") {
            // Advancing through custom steps within POST_PRODUCTION
            // Use the Daily Plan's current step
            const currentIndex = existingPlan.currentStepIndex || 1;
            const nextIndex = currentIndex + 1;
            
            if (nextIndex <= totalCustomStepsCount) {
              const nextStepName = customSteps[nextIndex - 1].stepKey;
              updateData.currentStepIndex = nextIndex;
              updateData.currentProductionStep = nextStepName;
              updateData.status = "POST_PRODUCTION"; // Keep daily plan in POST_PRODUCTION
            }
          } 
          else if (data.status === "COMPLETED" && existingPlan.status !== "COMPLETED") {
            updateData.currentStepIndex = totalCustomStepsCount + 1;
            updateData.currentProductionStep = "Completed";
            updateData.status = "COMPLETED";

            // If this plan was previously short-closed but is now completing normally via POST_PRODUCTION, strip the Short Closed remarks
            if (existingPlan.status === "POST_PRODUCTION" && existingPlan.remarks?.includes("Short Closed:")) {
              updateData.remarks = existingPlan.remarks.replace(/Short Closed:\s*/g, "").replace(/\s*\|\s*/g, " | ").trim();
            }

            // Check if all OTHER daily plans for this PO are completed or cancelled
            const otherPlans = await tx.dailyProductionPlan.findMany({
              where: { 
                productionOrderId: checkProductionOrderId,
                dailyPlanId: { not: dailyPlanId }
              }
            });
            const allOthersFinished = otherPlans.every((p: any) => p.status === "COMPLETED" || p.status === "CANCELLED" || p.status === "STOPPED" || p.status === "SHORT_CLOSED");

            const poTarget = Number(productionOrderFull.targetQty || 0);
            const poProduced = Number(productionOrderFull.producedQty || 0);
            const isTargetMet = poTarget > 0 && poProduced >= poTarget;

            // Only advance PO if all other plans are finished
            if (allOthersFinished) {
              const isShortClosed = existingPlan.status !== "POST_PRODUCTION";

              if (!isShortClosed) {
                // Normal flow: came from POST_PRODUCTION
                if (isTargetMet && productionOrderFull.status !== "READY_FOR_DISPATCH") {
                  await tx.productionOrder.update({
                    where: { productionOrderId: checkProductionOrderId },
                    data: { status: "READY_FOR_DISPATCH" },
                  });
                  await StatusSyncService.logHistory(
                    tx, checkProductionOrderId, productionOrderFull.status, "READY_FOR_DISPATCH", userId,
                    "All post-production steps completed and target quantity met. Ready for dispatch.", "READY_FOR_DISPATCH"
                  );
                } else if (productionOrderFull.status !== "PARTIAL_COMPLETED" && productionOrderFull.status !== "COMPLETED_WITH_SHORTFALL" && productionOrderFull.status !== "CLOSED" && productionOrderFull.status !== "DISPATCHED" && productionOrderFull.status !== "READY_FOR_DISPATCH") {
                  await tx.productionOrder.update({
                    where: { productionOrderId: checkProductionOrderId },
                    data: { status: "PARTIAL_COMPLETED" },
                  });
                  await StatusSyncService.logHistory(
                    tx, checkProductionOrderId, productionOrderFull.status, "PARTIAL_COMPLETED", userId,
                    "Partial post-production steps completed. Eligible for partial dispatch.", "PARTIAL_COMPLETED"
                  );
                }
              } else if (isShortClosed) {
                if (isTargetMet && !["READY_FOR_DISPATCH", "DISPATCHED"].includes(productionOrderFull.status)) {
                  // Short-closed but target qty is met: advance PO directly to READY_FOR_DISPATCH
                  await tx.productionOrder.update({
                    where: { productionOrderId: checkProductionOrderId },
                    data: { status: "READY_FOR_DISPATCH" },
                  });
                  await StatusSyncService.logHistory(
                    tx, checkProductionOrderId, productionOrderFull.status, "READY_FOR_DISPATCH", userId,
                    "Production completed (short-closed). Target quantity met. Ready for dispatch.", "READY_FOR_DISPATCH"
                  );
                } else if (!isTargetMet && !["PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED"].includes(productionOrderFull.status)) {
                  // Short-closed and target NOT met (Force Complete Stop): close the PO and Weekly Program
                  await tx.productionOrder.update({
                    where: { productionOrderId: checkProductionOrderId },
                    data: { status: "COMPLETED_WITH_SHORTFALL" },
                  });
                  await tx.weeklyMachineProgram.update({
                    where: { weeklyProgramId: checkWeeklyProgramId },
                    data: { status: "COMPLETED" },
                  });
                  await StatusSyncService.logHistory(
                    tx, checkProductionOrderId, productionOrderFull.status, "COMPLETED_WITH_SHORTFALL", userId,
                    "Production force-stopped (Complete Stop). No further planning allowed. Eligible for partial dispatch.", "COMPLETED_WITH_SHORTFALL"
                  );
                }
              }
            }
          }
        }
      }

      const updatedPlan = await dailyPlanRepository.update(dailyPlanId, updateData, tx);

      // Sync operators to junction table when selectedOperatorIds is updated
      if (data.selectedOperatorIds !== undefined) {
        // Remove all old assignments then re-insert new ones
        await tx.dailyPlanOperator.deleteMany({ where: { dailyPlanId } });
        if (data.selectedOperatorIds) {
          const opIds = data.selectedOperatorIds.split(",").map((id: string) => id.trim()).filter((id: string) => /^\d+$/.test(id));
          for (const opId of opIds) {
            await tx.dailyPlanOperator.upsert({
              where: { dailyPlanId_employeeId: { dailyPlanId, employeeId: BigInt(opId) } },
              create: { dailyPlanId, employeeId: BigInt(opId), createdBy: userId },
              update: {},
            }).catch(() => {}); // skip if employee doesn't exist
          }
        }
      }

      const operators = await this.filterOperators([], updatedPlan.selectedOperatorIds);
      return {
        ...updatedPlan,
        operators,
        shiftIncharge: null,
      };
    }, { timeout: 15000, maxWait: 10000 });
  }

  async delete(dailyPlanId: string) {
    const existingPlan = await dailyPlanRepository.findById(dailyPlanId);
    if (!existingPlan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    if (existingPlan.status !== "DRAFT" && existingPlan.status !== "PLANNED") {
      throw new ApiError(400, `Cannot delete Daily Plan because its status is ${existingPlan.status}. Only DRAFT or PLANNED shifts can be deleted.`);
    }

    // Verify if there are already hourly production logs registered
    const hourlyLogsCount = await prisma.hourlyProduction.count({
      where: { dailyPlanId },
    });

    if (hourlyLogsCount > 0) {
      throw new ApiError(400, `Cannot delete Daily Plan because it already has ${hourlyLogsCount} hourly production logs registered`);
    }

    // Block deletion if Raw Material has already been issued for this plan's date
    const planDateStr = (existingPlan.productionDate instanceof Date
      ? existingPlan.productionDate
      : new Date(existingPlan.productionDate)
    ).toISOString().split("T")[0];

    const rmIssued = await prisma.stockAdjustment.findFirst({
      where: {
        adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
        sourceDocument: "DAILY_PLAN",
        sourceDocId: planDateStr,
      },
      select: { id: true },
    });

    if (rmIssued) {
      throw new ApiError(
        400,
        `Cannot delete: Raw Material has already been issued for ${planDateStr}. This shift is locked.`
      );
    }

    // ✅ If this is the LAST daily plan for the PO, revert PO status back to WEEKLY_SCHEDULED
    const remainingPlans = await prisma.dailyProductionPlan.count({
      where: {
        productionOrderId: existingPlan.productionOrderId,
        dailyPlanId: { not: dailyPlanId },
      },
    });

    if (remainingPlans === 0) {
      const po = await prisma.productionOrder.findUnique({
        where: { productionOrderId: existingPlan.productionOrderId },
      });
      if (po && po.status === "DAILY_PLANNED") {
        await prisma.productionOrder.update({
          where: { productionOrderId: existingPlan.productionOrderId },
          data: { status: "WEEKLY_SCHEDULED" },
        });
      }
    }

    return dailyPlanRepository.delete(dailyPlanId);
  }

  private async filterOperators(assignedOperators: any[], selectedOperatorIds?: string | null) {
    if (!selectedOperatorIds || selectedOperatorIds.trim() === "") {
      return assignedOperators || [];
    }
    const selectedIds = selectedOperatorIds.split(",").map((id: string) => id.trim()).filter(Boolean);
    const filtered = (assignedOperators || []).filter((op: any) => 
      selectedIds.includes(op.id?.toString()) || 
      selectedIds.includes(op.employeeId?.toString()) || 
      selectedIds.includes(op.fullName) ||
      selectedIds.includes(op.empCode)
    );
    if (filtered.length < selectedIds.length) {
      const existingIds = new Set(filtered.map((op: any) => op.id?.toString()));
      const existingNames = new Set(filtered.map((op: any) => op.fullName));
      const existingCodes = new Set(filtered.map((op: any) => op.empCode));
      const missingIds = selectedIds.filter((id: string) => !existingIds.has(id) && !existingNames.has(id) && !existingCodes.has(id));
      if (missingIds.length > 0) {
        try {
          const numericIds = missingIds.filter((id: string) => /^\d+$/.test(id));
          const stringValues = missingIds.filter((id: string) => !/^\d+$/.test(id));
          const whereClauses: any[] = [];
          if (numericIds.length > 0) {
            whereClauses.push({ id: { in: numericIds.map((id: string) => BigInt(id)) } });
          }
          if (stringValues.length > 0) {
            whereClauses.push({ fullName: { in: stringValues } });
            whereClauses.push({ empCode: { in: stringValues } });
          }
          if (whereClauses.length > 0) {
            const missingEmps = await prisma.employee.findMany({
              where: { OR: whereClauses, status: { not: "draft" } }
            });
            for (const emp of missingEmps) {
              if (!filtered.some((f: any) => f.id === emp.id.toString())) {
                filtered.push({
                  id: emp.id.toString(),
                  empCode: emp.empCode,
                  fullName: emp.fullName,
                  status: emp.status,
                });
              }
            }
          }
        } catch (e) {
          console.error("Error fetching missing employee details:", e);
        }
      }
    }
    return filtered;
  }

  async findById(dailyPlanId: string) {
    const plan = await dailyPlanRepository.findById(dailyPlanId);
    if (!plan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    const operators = await this.filterOperators([], plan.selectedOperatorIds);

    return {
      ...plan,
      operators,
      shiftIncharge: null,
    };
  }

  async findAll(filters: {
    weeklyProgramId?: string;
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productionDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    let dateObj: Date | undefined;
    if (filters.productionDate) {
      const [yyyy, mm, dd] = filters.productionDate.split("-").map(Number);
      dateObj = new Date(Date.UTC(yyyy, mm - 1, dd));
    }

    const result = await dailyPlanRepository.findAll({
      weeklyProgramId: filters.weeklyProgramId,
      productionOrderId: filters.productionOrderId,
      machineId: filters.machineId,
      shiftId: filters.shiftId,
      productionDate: dateObj,
      status: filters.status,
      page: filters.page,
      limit: filters.limit,
    });

    const plansWithAssignments = await Promise.all(result.dailyPlans.map(async (plan: any) => {
      try {
        const operators = await this.filterOperators([], plan.selectedOperatorIds);
        return {
          ...plan,
          operators,
          shiftIncharge: null,
        };
      } catch (err) {
        return {
          ...plan,
          operators: [],
          operator: null,
          shiftIncharge: null,
        };
      }
    }));

    return {
      ...result,
      dailyPlans: plansWithAssignments,
    };
  }

  // ── Products assigned to a machine for a given week (for hourly-entry product dropdown) ──
  async getWeekProducts(machineId: string, weekStart: string) {
    const [yyyy, mm, dd] = weekStart.split("-").map(Number);
    const weekStartDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const programs = await dailyPlanRepository.findWeeklyProgramsByMachineAndWeek(machineId, weekStartDate);

    return programs
      .filter((wp: any) => wp.productionOrder?.productItem)
      .map((wp: any) => ({
        productionOrderId: wp.productionOrderId,
        weeklyProgramId: wp.weeklyProgramId,
        product: {
          id: wp.productionOrder.productItem.id,
          productName: wp.productionOrder.productItem.productName,
          productCode: wp.productionOrder.productItem.productCode,
        },
      }));
  }

  // ── Auto-create (or reuse) a Daily Plan for a product that is already part of a
  // machine's week-assigned product set, so an hourly entry can be logged against it
  // even though nobody explicitly scheduled it for this exact day+shift via the board.
  // Used to let a shift split its remaining hours onto a second week-assigned product
  // when the originally planned product's run is cut short.
  async autoCreateSecondaryPlan(productionOrderId: string, machineId: string, shiftId: string, prodDate: Date, userId?: string) {
    const weekStart = new Date(prodDate);
    const dow = weekStart.getUTCDay();
    weekStart.setUTCDate(weekStart.getUTCDate() - (dow === 0 ? 6 : dow - 1));

    // Only allow this for products genuinely assigned to this machine's week — never an arbitrary PO
    const weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
      where: { productionOrderId, machineId, weekStartDate: weekStart },
    });
    if (!weeklyProgram) return null;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.dailyProductionPlan.findFirst({
        where: { productionOrderId, machineId, shiftId, productionDate: prodDate },
      });
      if (existing) return existing;

      const productionOrder = await tx.productionOrder.findUnique({ where: { productionOrderId } });
      if (!productionOrder) return null;

      const nextId = await this.generateNextDailyPlanId(tx);
      const created = await tx.dailyProductionPlan.create({
        data: {
          dailyPlanId: nextId,
          weeklyProgramId: weeklyProgram.weeklyProgramId,
          productionOrderId,
          productionDate: prodDate,
          machineId,
          shiftId,
          plannedQty: Number(weeklyProgram.plannedQty) || 0,
          status: "IN_PROGRESS",
          priority: "MEDIUM",
          createdBy: userId,
        },
      });

      if (productionOrder.status === "WEEKLY_SCHEDULED" || productionOrder.status === "SCHEDULED") {
        await tx.productionOrder.update({
          where: { productionOrderId },
          data: { status: "DAILY_PLANNED" },
        });
        await StatusSyncService.logHistory(
          tx,
          productionOrderId,
          productionOrder.status,
          "DAILY_PLANNED",
          userId,
          `Daily production plan ${nextId} auto-created for ${prodDate.toISOString().split("T")[0]} (secondary product for shift already in progress)`,
          "DAILY_PLAN_CREATED"
        );
      }

      return created;
    }, { timeout: 15000, maxWait: 10000 });
  }

  // ── Find or auto-create a WeeklyMachineProgram ────────────────────────────
  private async findOrCreateWeeklyProgram(
    tx: any,
    productionOrderId: string,
    machineId: string,
    weekStartDate: Date,
    weekEndDate: Date,
    plannedQty: number,
    userId?: string
  ): Promise<string> {
    // Find existing WP for this PO + machine + week
    const existing = await tx.weeklyMachineProgram.findFirst({
      where: { productionOrderId, machineId, weekStartDate },
      select: { weeklyProgramId: true },
    });
    if (existing) return existing.weeklyProgramId;

    // Generate next WP ID
    const latest = await tx.weeklyMachineProgram.findFirst({
      orderBy: { createdAt: "desc" },
      select: { weeklyProgramId: true },
    });
    let nextId = "WP0001";
    if (latest?.weeklyProgramId) {
      const match = latest.weeklyProgramId.match(/\d+/);
      if (match) {
        nextId = `WP${String(parseInt(match[0], 10) + 1).padStart(4, "0")}`;
      }
    }

    const wp = await tx.weeklyMachineProgram.create({
      data: {
        weeklyProgramId: nextId,
        weekStartDate,
        weekEndDate,
        machineId,
        dayOfWeek: 0,
        plannedQty,
        status: "WEEKLY_SCHEDULED",
        productionOrderId,
        priority: "MEDIUM",
        createdBy: userId,
      },
    });

    return wp.weeklyProgramId;
  }

  // ── Bulk create / update daily plans (from Weekly Production Plan board) ───────────
  async bulkCreate(data: BulkCreateDailyPlanInput, userId?: string) {
    const { items, status = "DRAFT", weekStart: inputWeekStart } = data;
    const created: any[] = [];

    // If weekStart is specified, clean up any unassigned/removed draft or planned shifts for that week
    if (inputWeekStart) {
      const [wY, wM, wD] = inputWeekStart.split("-").map(Number);
      const wStartDate = new Date(Date.UTC(wY, wM - 1, wD, 0, 0, 0));
      const wEndDate = new Date(wStartDate);
      wEndDate.setUTCDate(wStartDate.getUTCDate() + 5);
      wEndDate.setUTCHours(23, 59, 59, 999);

      const existingWeekPlans = await prisma.dailyProductionPlan.findMany({
        where: {
          productionDate: { gte: wStartDate, lte: wEndDate },
          status: { in: ["DRAFT", "PLANNED"] },
          hourlyProductions: { none: {} },
        },
      });

      const incomingKeySet = new Set(
        items.map(it => `${it.productionOrderId}__${it.machineId}__${it.shiftId}__${it.productionDate}`)
      );

      for (const ex of existingWeekPlans) {
        const exDateStr = ex.productionDate.toISOString().split("T")[0];
        const key = `${ex.productionOrderId}__${ex.machineId}__${ex.shiftId}__${exDateStr}`;
        if (!incomingKeySet.has(key)) {
          try {
            await this.delete(ex.dailyPlanId);
          } catch (e) {
            console.warn(`Could not clean up unassigned plan ${ex.dailyPlanId}:`, e);
          }
        }
      }
    }



    for (const item of items) {
      const [yyyy, mm, dd] = item.productionDate.split("-").map(Number);
      const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

      // Calculate Mon–Sat of the week containing prodDate
      const weekStart = new Date(prodDate);
      const dow = weekStart.getUTCDay();
      weekStart.setUTCDate(weekStart.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 5); // Saturday

      // Validate PO exists and is schedulable
      const productionOrder = await prisma.productionOrder.findUnique({
        where: { productionOrderId: item.productionOrderId },
        select: { status: true, targetQty: true, producedQty: true },
      });
      if (!productionOrder) continue; // skip missing POs silently in bulk

      const schedulable = ["WEEKLY_SCHEDULED", "SCHEDULED", "DAILY_PLANNED", "IN_PROGRESS",
        "POST_PRODUCTION", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED"];
      if (!schedulable.includes(productionOrder.status)) continue;

      const plan = await prisma.$transaction(async (tx) => {
        // Find or create WeeklyMachineProgram
        const wpId = item.weeklyProgramId
          ? item.weeklyProgramId
          : await this.findOrCreateWeeklyProgram(
              tx,
              item.productionOrderId,
              item.machineId,
              weekStart,
              weekEnd,
              item.plannedQty,
              userId
            );

        // Check if plan already exists for this slot
        const existingPlan = await tx.dailyProductionPlan.findFirst({
          where: {
            productionOrderId: item.productionOrderId,
            machineId: item.machineId,
            shiftId: item.shiftId,
            productionDate: prodDate,
          },
          select: { dailyPlanId: true, status: true },
        });

        if (existingPlan) {
          if (["DRAFT", "PLANNED"].includes(existingPlan.status)) {
            return tx.dailyProductionPlan.update({
              where: { dailyPlanId: existingPlan.dailyPlanId },
              data: {
                plannedQty: item.plannedQty,
                status,
              },
            });
          }
          return null;
        }

        const nextId = await this.generateNextDailyPlanId(tx);

        const newPlan = await tx.dailyProductionPlan.create({
          data: {
            dailyPlanId: nextId,
            weeklyProgramId: wpId,
            productionOrderId: item.productionOrderId,
            productionDate: prodDate,
            machineId: item.machineId,
            shiftId: item.shiftId,
            plannedQty: item.plannedQty,
            status,
            priority: "MEDIUM",
            createdBy: userId,
          },
        });

        // Transition PO to DAILY_PLANNED on first plan
        if (productionOrder.status === "WEEKLY_SCHEDULED" || productionOrder.status === "SCHEDULED") {
          await tx.productionOrder.update({
            where: { productionOrderId: item.productionOrderId },
            data: { status: "DAILY_PLANNED" },
          });
          await StatusSyncService.logHistory(
            tx,
            item.productionOrderId,
            productionOrder.status,
            "DAILY_PLANNED",
            userId,
            `Daily production plan ${nextId} created via bulk planning`,
            "DAILY_PLAN_CREATED"
          );
        }

        return newPlan;
      }, { timeout: 15000, maxWait: 10000 });

      if (plan) created.push(plan);
    }

    return created;
  }

  // ── Bulk delete daily plans ───────────────────────────────────────────────
  async bulkDelete(dailyPlanIds: string[]) {
    const plans = await prisma.dailyProductionPlan.findMany({
      where: { dailyPlanId: { in: dailyPlanIds } },
      select: { dailyPlanId: true, status: true },
    });

    const activeOrFinished = plans.filter(p => p.status !== "DRAFT" && p.status !== "PLANNED");
    if (activeOrFinished.length > 0) {
      throw new ApiError(
        400,
        `Cannot delete: ${activeOrFinished.length} shift(s) are already in progress, completed, or stopped. Only Draft or Planned shifts can be deleted.`
      );
    }

    const deleted: string[] = [];
    const skipped: { dailyPlanId: string; reason: string }[] = [];

    for (const id of dailyPlanIds) {
      try {
        await this.delete(id);
        deleted.push(id);
      } catch (err: any) {
        skipped.push({ dailyPlanId: id, reason: err.message || "Failed to delete" });
      }
    }

    return { deleted, skipped };
  }

  // ── Raw Material Requirements for a Day / Week ──────────────────────────
  async getRawMaterialRequirements(
    params: string | { date?: string; weekStart?: string; shiftId?: string; machineId?: string; productId?: string }
  ) {
    const rawDate = typeof params === "string" ? params : (params.date || params.weekStart || new Date().toISOString().split("T")[0]);
    const filterShiftId = typeof params === "object" ? params.shiftId : undefined;
    const filterMachineId = typeof params === "object" ? params.machineId : undefined;
    const filterProductId = typeof params === "object" ? params.productId : undefined;

    const [yyyy, mm, dd] = rawDate.split("-").map(Number);
    const targetDateStr = rawDate;

    // Determine week boundaries (Monday to Sunday)
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    const dayOfWeek = d.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStartUtc = new Date(d);
    weekStartUtc.setUTCDate(d.getUTCDate() + diffToMonday);

    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(weekStartUtc);
      cur.setUTCDate(weekStartUtc.getUTCDate() + i);
      weekDates.push(cur.toISOString().split("T")[0]);
    }

    const weekStartDate = new Date(Date.UTC(
      Number(weekDates[0].split("-")[0]),
      Number(weekDates[0].split("-")[1]) - 1,
      Number(weekDates[0].split("-")[2])
    ));
    const weekEndDate = new Date(Date.UTC(
      Number(weekDates[6].split("-")[0]),
      Number(weekDates[6].split("-")[1]) - 1,
      Number(weekDates[6].split("-")[2]),
      23, 59, 59, 999
    ));

    // Fetch all active plans for the week with machine, shift, product, BOM, and raw materials
    const plans = await prisma.dailyProductionPlan.findMany({
      where: {
        productionDate: { gte: weekStartDate, lte: weekEndDate },
        status: { notIn: ["CANCELLED", "STOPPED", "SHORT_CLOSED"] },
      },
      include: {
        machine: true,
        productionOrder: {
          include: {
            productItem: {
              include: {
                billOfMaterials: {
                  include: {
                    rawMaterial: {
                      include: { store: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { productionDate: "asc" },
        { shiftId: "asc" },
        { machineId: "asc" },
      ],
    });

    // Fetch stock adjustments for the week's dates
    const existingIssues = await prisma.stockAdjustment.findMany({
      where: {
        sourceDocument: "DAILY_PLAN",
        sourceDocId: { in: weekDates },
        status: { not: "REJECTED" },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Map issued quantities by date and rawMaterialId
    const issuedMapByDate = new Map<string, Map<string, number>>();
    for (const issue of existingIssues) {
      const issueDate = issue.sourceDocId || "";
      if (!issuedMapByDate.has(issueDate)) {
        issuedMapByDate.set(issueDate, new Map<string, number>());
      }
      const dateMap = issuedMapByDate.get(issueDate)!;
      for (const item of issue.items) {
        if (item.rawMaterialId) {
          const prev = dateMap.get(item.rawMaterialId) || 0;
          const qtyIssued = Math.abs(Number(item.difference || 0)) || (Number(item.currentQty || 0) - Number(item.adjustedQty || 0));
          dateMap.set(item.rawMaterialId, Number((prev + qtyIssued).toFixed(3)));
        }
      }
    }

    const dayIssuedMap = issuedMapByDate.get(targetDateStr) || new Map<string, number>();

    // Helper: Normalize shift label to static Day or Night
    const getShiftLabel = (sId: string, sName?: string) => {
      const s = ((sName || "") + " " + (sId || "")).toUpperCase();
      if (s.includes("NIGHT") || s.includes("EVENING") || s.includes("SHIFT2") || s.includes("SHIFT 2") || s.includes("S2") || s.includes("SHT002")) {
        return "Night";
      }
      return "Day";
    };

    // Helper: Convert product weight to KG
    const getWeightInKg = (weight: number, uom?: string | null) => {
      if (!weight || isNaN(weight)) return 0;
      const u = (uom || "g").trim().toLowerCase();
      if (u === "g" || u === "gram" || u === "grams" || u === "gm") {
        return weight / 1000;
      }
      if (u === "kg" || u === "kgs" || u === "kilogram" || u === "kilograms") {
        return weight;
      }
      if (u === "t" || u === "ton" || u === "tonne" || u === "tons") {
        return weight * 1000;
      }
      return weight > 50 ? weight / 1000 : weight;
    };

    // ── Build Day-Specific Granular Breakdown ──────────────────────────────────
    const targetDayPlans = plans.filter((p) => {
      const pDateStr = p.productionDate.toISOString().split("T")[0];
      if (pDateStr !== targetDateStr) return false;
      if (filterShiftId) {
        const isNight = getShiftLabel(p.shiftId) === "Night";
        const slot = isNight ? "NIGHT" : "DAY";
        if (filterShiftId.toUpperCase() === "DAY" && slot !== "DAY") return false;
        if (filterShiftId.toUpperCase() === "NIGHT" && slot !== "NIGHT") return false;
        if (filterShiftId.toUpperCase() !== "DAY" && filterShiftId.toUpperCase() !== "NIGHT" && p.shiftId !== filterShiftId) return false;
      }
      if (filterMachineId && p.machineId !== filterMachineId) return false;
      if (filterProductId) {
        const pId = String(p.productionOrder?.productItemId || p.productionOrder?.productItem?.id || "");
        if (pId !== filterProductId) return false;
      }
      return true;
    });

    interface PlanBomDetail {
      rawMaterialId: string;
      materialName: string;
      bomPercentage: number;
      requiredPerUnit: number;
      requiredPerUnitKg: number;
      requiredQty: number;
      uom: string;
      currentStock: number;
      availableStock: number;
      issuedQty: number;
      remainingQty: number;
      shortage: number;
      status: "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED" | "SHORTAGE";
      storeId: string;
      storeName: string;
    }

    interface PlanMachineItem {
      dailyPlanId: string;
      productionOrderId: string;
      productId: string;
      productCode: string;
      productName: string;
      plannedQty: number;
      productUom: string;
      weightPerPiece: number;
      weightUom: string;
      totalMaterialRequiredKg: number;
      bomTotalPercentage: number;
      bomWarning: string | null;
      status: string;
      bomComposition: PlanBomDetail[];
    }

    interface ShiftGroup {
      shiftId: string;
      shiftName: string;
      shiftLabel: string;
      summary: {
        totalOrders: number;
        totalProducts: number;
        totalProductionQty: number;
        totalRmRequiredKg: number;
        totalRmIssuedKg: number;
      };
      machines: Array<{
        machineId: string;
        machineName: string;
        plans: PlanMachineItem[];
        machineConsolidated: Array<{
          rawMaterialId: string;
          materialName: string;
          requiredQty: number;
          uom: string;
          availableStock: number;
          issuedQty: number;
          remainingQty: number;
          shortage: number;
          status: string;
        }>;
      }>;
      consolidatedMaterials: Array<{
        rawMaterialId: string;
        materialName: string;
        requiredQty: number;
        uom: string;
        availableStock: number;
        issuedQty: number;
        remainingQty: number;
        shortage: number;
        status: string;
        storeId: string;
        storeName: string;
      }>;
    }

    const shiftMap = new Map<string, ShiftGroup>();

    const dayRmConsolidatedMap = new Map<string, {
      rawMaterialId: string;
      materialName: string;
      dayQty: number;
      nightQty: number;
      totalRequired: number;
      onHandQty: number;      // physical stock (raw, before subtracting reserved)
      availableStock: number;
      issuedQty: number;
      remainingQty: number;
      shortage: number;
      status: "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED" | "SHORTAGE";
      uom: string;
      storeId: string;
      storeName: string;
    }>();

    for (const plan of targetDayPlans) {
      const isNight = getShiftLabel(plan.shiftId) === "Night";
      const shiftId = isNight ? "NIGHT" : "DAY";
      const shiftName = isNight ? "Night Shift" : "Day Shift";
      const shiftLabel = isNight ? "Night" : "Day";
      const machineId = plan.machineId;
      const machineName = plan.machine?.machineName || machineId;

      if (!shiftMap.has(shiftId)) {
        shiftMap.set(shiftId, {
          shiftId,
          shiftName,
          shiftLabel,
          summary: {
            totalOrders: 0,
            totalProducts: 0,
            totalProductionQty: 0,
            totalRmRequiredKg: 0,
            totalRmIssuedKg: 0,
          },
          machines: [],
          consolidatedMaterials: [],
        });
      }

      const currentShift = shiftMap.get(shiftId)!;
      let machineGroup = currentShift.machines.find((m) => m.machineId === machineId);
      if (!machineGroup) {
        machineGroup = {
          machineId,
          machineName,
          plans: [],
          machineConsolidated: [],
        };
        currentShift.machines.push(machineGroup);
      }

      const productItem = plan.productionOrder?.productItem;
      const plannedQty = Number(plan.plannedQty || 0);
      const rawWeight = Number(
        (plan.productionOrder as any)?.weightPerPieceUsed ||
        productItem?.weightPerPiece ||
        0
      );
      const weightUom = (productItem?.weightUom || "g").trim();
      const weightInKg = getWeightInKg(rawWeight, weightUom);
      const totalMaterialRequiredKg = Number((plannedQty * weightInKg).toFixed(3));

      const boms = productItem?.billOfMaterials || [];
      const bomTotalPercentage = boms.reduce((acc, b) => acc + Number(b.percentage || 0), 0);
      const bomWarning =
        boms.length > 0 && bomTotalPercentage > 0 && Math.abs(bomTotalPercentage - 100) > 0.1
          ? `BOM composition must total 100% (currently ${bomTotalPercentage}%).`
          : null;

      const bomComposition: PlanBomDetail[] = [];

      for (const bomItem of boms) {
        const rm = bomItem.rawMaterial;
        if (!rm) continue;

        const rmId = bomItem.rawMaterialId;
        const pct = Number(bomItem.percentage || 0);
        let reqPerUnit = Number(bomItem.requiredQuantity || 0);
        let reqPerUnitKg = 0;

        if (pct > 0 && weightInKg > 0) {
          reqPerUnitKg = (weightInKg * pct) / 100;
          reqPerUnit = weightUom.toLowerCase() === "g" ? (rawWeight * pct) / 100 : reqPerUnitKg;
        } else if (reqPerUnit > 0) {
          const bUom = (bomItem.uom || rm.baseUom || "kg").toLowerCase();
          reqPerUnitKg = bUom.includes("g") && !bUom.includes("kg") ? reqPerUnit / 1000 : reqPerUnit;
        }

        const requiredKg = Number((plannedQty * reqPerUnitKg).toFixed(3));
        const onHand = Number(rm.onHandQty || 0);
        const reserved = Number(rm.reservedQty || 0);
        const availableStock = Math.max(0, Number((onHand - reserved).toFixed(3)));
        const totalDayIssued = dayIssuedMap.get(rmId) || 0;

        let status: PlanBomDetail["status"] = "NOT_ISSUED";
        if (totalDayIssued >= requiredKg && requiredKg > 0) {
          status = "FULLY_ISSUED";
        } else if (totalDayIssued > 0) {
          status = "PARTIALLY_ISSUED";
        } else if (availableStock < requiredKg) {
          status = "SHORTAGE";
        }

        const remaining = Math.max(0, Number((requiredKg - totalDayIssued).toFixed(3)));
        const shortage = Math.max(0, Number((remaining - availableStock).toFixed(3)));

        const bomDetail: PlanBomDetail = {
          rawMaterialId: rmId,
          materialName: rm.materialName,
          bomPercentage: pct,
          requiredPerUnit: Number(reqPerUnit.toFixed(4)),
          requiredPerUnitKg: Number(reqPerUnitKg.toFixed(4)),
          requiredQty: requiredKg,
          uom: primaryUom(bomItem.uom || rm.baseUom, "KG"),
          currentStock: onHand,
          availableStock,
          issuedQty: totalDayIssued,
          remainingQty: remaining,
          shortage,
          status,
          storeId: rm.storeId || "",
          storeName: (rm as any).store?.storeName || "Main Store",
        };

        bomComposition.push(bomDetail);

        const isNightShift = shiftLabel.toLowerCase().includes("night");
        if (!dayRmConsolidatedMap.has(rmId)) {
          dayRmConsolidatedMap.set(rmId, {
            rawMaterialId: rmId,
            materialName: rm.materialName,
            dayQty: isNightShift ? 0 : requiredKg,
            nightQty: isNightShift ? requiredKg : 0,
            totalRequired: requiredKg,
            onHandQty: onHand,
            availableStock,
            issuedQty: totalDayIssued,
            remainingQty: Math.max(0, Number((requiredKg - totalDayIssued).toFixed(3))),
            shortage: Math.max(0, Number((Math.max(0, requiredKg - totalDayIssued) - availableStock).toFixed(3))),
            status: "NOT_ISSUED",
            uom: primaryUom(bomItem.uom || rm.baseUom, "KG"),
            storeId: rm.storeId || "",
            storeName: (rm as any).store?.storeName || "Main Store",
          });
        } else {
          const entry = dayRmConsolidatedMap.get(rmId)!;
          if (isNightShift) {
            entry.nightQty = Number((entry.nightQty + requiredKg).toFixed(3));
          } else {
            entry.dayQty = Number((entry.dayQty + requiredKg).toFixed(3));
          }
          entry.totalRequired = Number((entry.totalRequired + requiredKg).toFixed(3));
          entry.remainingQty = Math.max(0, Number((entry.totalRequired - entry.issuedQty).toFixed(3)));
          entry.shortage = Math.max(0, Number((entry.remainingQty - entry.availableStock).toFixed(3)));
        }
      }

      const planItem: PlanMachineItem = {
        dailyPlanId: plan.dailyPlanId,
        productionOrderId: plan.productionOrderId,
        productId: String(productItem?.id || plan.productionOrder?.productItemId || ""),
        productCode: productItem?.productCode || "",
        productName: productItem?.productName || "—",
        plannedQty,
        productUom: "PCS",
        weightPerPiece: rawWeight,
        weightUom,
        totalMaterialRequiredKg,
        bomTotalPercentage,
        bomWarning,
        status: plan.status,
        bomComposition,
      };

      machineGroup.plans.push(planItem);
      currentShift.summary.totalOrders += 1;
      currentShift.summary.totalProductionQty += plannedQty;
      currentShift.summary.totalRmRequiredKg = Number(
        (currentShift.summary.totalRmRequiredKg + totalMaterialRequiredKg).toFixed(3)
      );
    }

    for (const shift of shiftMap.values()) {
      const shiftRmMap = new Map<string, {
        rawMaterialId: string;
        materialName: string;
        requiredQty: number;
        uom: string;
        availableStock: number;
        issuedQty: number;
        remainingQty: number;
        shortage: number;
        status: string;
        storeId: string;
        storeName: string;
      }>();

      for (const machine of shift.machines) {
        const machRmMap = new Map<string, {
          rawMaterialId: string;
          materialName: string;
          requiredQty: number;
          uom: string;
          availableStock: number;
          issuedQty: number;
          remainingQty: number;
          shortage: number;
          status: string;
        }>();

        for (const plan of machine.plans) {
          for (const bom of plan.bomComposition) {
            if (machRmMap.has(bom.rawMaterialId)) {
              const mEntry = machRmMap.get(bom.rawMaterialId)!;
              mEntry.requiredQty = Number((mEntry.requiredQty + bom.requiredQty).toFixed(3));
            } else {
              machRmMap.set(bom.rawMaterialId, {
                rawMaterialId: bom.rawMaterialId,
                materialName: bom.materialName,
                requiredQty: bom.requiredQty,
                uom: bom.uom,
                availableStock: bom.availableStock,
                issuedQty: bom.issuedQty,
                remainingQty: bom.remainingQty,
                shortage: bom.shortage,
                status: bom.status,
              });
            }

            if (shiftRmMap.has(bom.rawMaterialId)) {
              const sEntry = shiftRmMap.get(bom.rawMaterialId)!;
              sEntry.requiredQty = Number((sEntry.requiredQty + bom.requiredQty).toFixed(3));
            } else {
              shiftRmMap.set(bom.rawMaterialId, {
                rawMaterialId: bom.rawMaterialId,
                materialName: bom.materialName,
                requiredQty: bom.requiredQty,
                uom: bom.uom,
                availableStock: bom.availableStock,
                issuedQty: bom.issuedQty,
                remainingQty: bom.remainingQty,
                shortage: bom.shortage,
                status: bom.status,
                storeId: bom.storeId,
                storeName: bom.storeName,
              });
            }
          }
        }

        machine.machineConsolidated = Array.from(machRmMap.values());
      }

      const shiftConsolidated = Array.from(shiftRmMap.values()).map((item) => {
        const remaining = Math.max(0, Number((item.requiredQty - item.issuedQty).toFixed(3)));
        const shortage = Math.max(0, Number((remaining - item.availableStock).toFixed(3)));
        let status = "NOT_ISSUED";
        if (item.issuedQty >= item.requiredQty && item.requiredQty > 0) status = "FULLY_ISSUED";
        else if (item.issuedQty > 0) status = "PARTIALLY_ISSUED";
        else if (shortage > 0) status = "SHORTAGE";
        return {
          ...item,
          remainingQty: remaining,
          shortage,
          status,
        };
      });

      shift.consolidatedMaterials = shiftConsolidated;
      shift.summary.totalProducts = new Set(
        shift.machines.flatMap((m) => m.plans.map((p) => p.productId))
      ).size;
      shift.summary.totalRmIssuedKg = shiftConsolidated.reduce((acc, c) => acc + Math.min(c.issuedQty, c.requiredQty), 0);
    }

    const dailyConsolidated = Array.from(dayRmConsolidatedMap.values()).map((item) => {
      const remaining = Math.max(0, Number((item.totalRequired - item.issuedQty).toFixed(3)));
      const shortage = Math.max(0, Number((remaining - item.availableStock).toFixed(3)));
      let status: "NOT_ISSUED" | "PARTIALLY_ISSUED" | "FULLY_ISSUED" | "SHORTAGE" = "NOT_ISSUED";
      if (item.issuedQty >= item.totalRequired && item.totalRequired > 0) status = "FULLY_ISSUED";
      else if (item.issuedQty > 0) status = "PARTIALLY_ISSUED";
      else if (shortage > 0) status = "SHORTAGE";
      return {
        ...item,
        remainingQty: remaining,
        shortage,
        status,
      };
    });

    const totalProductionQty = targetDayPlans.reduce((sum, p) => sum + Number(p.plannedQty || 0), 0);
    const totalRmRequired = Number(dailyConsolidated.reduce((sum, r) => sum + r.totalRequired, 0).toFixed(3));
    const totalRmIssued = Number(dailyConsolidated.reduce((sum, r) => sum + Math.min(r.issuedQty, r.totalRequired), 0).toFixed(3));
    const totalPendingIssue = Number(dailyConsolidated.reduce((sum, r) => sum + r.remainingQty, 0).toFixed(3));
    const totalShortage = Number(dailyConsolidated.reduce((sum, r) => sum + r.shortage, 0).toFixed(3));

    // Weekly summary
    const weekSummary = weekDates.map((wDate) => {
      const dayPlans = plans.filter((p) => p.productionDate.toISOString().split("T")[0] === wDate);
      const dayName = new Date(wDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const dayIssues = issuedMapByDate.get(wDate) || new Map<string, number>();

      let dayProdQty = 0;
      let dayRmReq = 0;
      let dayRmIssued = 0;

      const shiftSummaries: Array<{
        shiftId: string;
        shiftName: string;
        shiftLabel: string;
        productionQty: number;
        rmRequiredKg: number;
        rmIssuedKg: number;
      }> = [];

      const shiftGroups = new Map<string, typeof dayPlans>();
      for (const p of dayPlans) {
        if (!shiftGroups.has(p.shiftId)) shiftGroups.set(p.shiftId, []);
        shiftGroups.get(p.shiftId)!.push(p);
      }

      for (const [sId, sPlans] of shiftGroups.entries()) {
        const sName = sPlans[0]?.shiftId === "NIGHT" ? "Night Shift" : "Day Shift";
        const sLabel = getShiftLabel(sId, sName);
        let sProdQty = 0;
        let sRmReq = 0;

        for (const p of sPlans) {
          const qty = Number(p.plannedQty || 0);
          const rawWeight = Number((p.productionOrder as any)?.weightPerPieceUsed || p.productionOrder?.productItem?.weightPerPiece || 0);
          const weightKg = getWeightInKg(rawWeight, p.productionOrder?.productItem?.weightUom);
          sProdQty += qty;
          sRmReq += qty * weightKg;
        }

        shiftSummaries.push({
          shiftId: sId,
          shiftName: sName,
          shiftLabel: sLabel,
          productionQty: sProdQty,
          rmRequiredKg: Number(sRmReq.toFixed(3)),
          rmIssuedKg: 0,
        });

        dayProdQty += sProdQty;
        dayRmReq += sRmReq;
      }

      for (const issued of dayIssues.values()) {
        dayRmIssued += issued;
      }

      return {
        date: wDate,
        dayName,
        totalProductionQty: dayProdQty,
        totalRmRequired: Number(dayRmReq.toFixed(3)),
        totalRmIssued: Number(dayRmIssued.toFixed(3)),
        shifts: shiftSummaries,
        planCount: dayPlans.length,
      };
    });

    const dayIssue = existingIssues.find((i) => i.sourceDocId === targetDateStr);

    return {
      date: targetDateStr,
      weekStart: weekDates[0],
      weekDates,
      kpiSummary: {
        totalProductionQty,
        totalRmRequired,
        totalRmIssued,
        totalPendingIssue,
        totalShortage,
      },
      shifts: Array.from(shiftMap.values()).sort((a, b) => a.shiftLabel.localeCompare(b.shiftLabel)),
      dailyConsolidated,
      weekSummary,
      planCount: targetDayPlans.length,
      alreadyIssued: !!dayIssue,
      issueId: dayIssue ? dayIssue.id.toString() : null,
      issueNumber: dayIssue?.adjustmentNumber ?? null,
      existingIssues: existingIssues.filter((i) => i.sourceDocId === targetDateStr).map((i) => ({
        id: i.id.toString(),
        adjustmentNumber: i.adjustmentNumber,
        adjustmentDate: i.adjustmentDate,
        status: i.status,
        items: (i.items || []).map((it) => ({
          rawMaterialId: it.rawMaterialId,
          qty: Math.abs(Number(it.difference || 0)),
          difference: it.difference,
          remarks: it.remarks,
        })),
      })),
    };
  }

  // ── Get dates within a week that had RM issued ───────────────────────────
  async getRmIssuedDates(weekStart: string): Promise<string[]> {
    const [y, m, d] = weekStart.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end   = new Date(Date.UTC(y, m - 1, d + 6, 23, 59, 59)); // Mon – Sun inclusive

    const weekDates: string[] = [];
    for (let offset = 0; offset <= 6; offset++) {
      const cur = new Date(Date.UTC(y, m - 1, d + offset));
      weekDates.push(cur.toISOString().split("T")[0]);
    }

    const rows = await prisma.stockAdjustment.findMany({
      where: {
        adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
        sourceDocument: "DAILY_PLAN",
        status: { not: "REJECTED" },
        OR: [
          { sourceDocId: { in: weekDates } },
          { adjustmentDate: { gte: start, lte: end } },
        ],
      },
      select: { sourceDocId: true, adjustmentDate: true },
    });

    const result = new Set<string>();
    for (const r of rows) {
      if (r.sourceDocId && weekDates.includes(r.sourceDocId)) {
        result.add(r.sourceDocId);
      } else if (r.sourceDocId) {
        result.add(r.sourceDocId);
      } else if (r.adjustmentDate) {
        result.add(r.adjustmentDate.toISOString().split("T")[0]);
      }
    }

    return Array.from(result);
  }

  // ── Issue Raw Materials for a Day ────────────────────────────────────────
  async issueRawMaterialsForDay(
    date: string,
    items: Array<{ rawMaterialId: string; storeId: string; issuedQty: number; remarks?: string }>,
    userId: string
  ) {
    const rmData: Array<{ rm: any; item: typeof items[0] }> = [];
    for (const item of items) {
      if (item.issuedQty <= 0) continue;
      const rm = await prisma.rawMaterial.findUnique({
        where: { rawMaterialId: item.rawMaterialId },
      });
      if (!rm) throw new ApiError(404, `Raw Material ${item.rawMaterialId} not found`);
      rmData.push({ rm, item });
    }

    if (rmData.length === 0) {
      throw new ApiError(400, "No valid items to issue. Quantity must be greater than zero.");
    }

    const adjustmentNumber = await StockAdjustmentService.getNextAdjustmentNumber();

    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: new Date(`${date}T00:00:00.000Z`),
          adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
          reason: `Daily production raw material issue for ${date}`,
          status: "APPROVED",
          sourceDocument: "DAILY_PLAN",
          sourceDocId: date,
          autoGenerated: false,
          approvedBy: userId,
          approvedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
          items: {
            create: rmData.map(({ rm, item }) => {
              const currentQty = Number(rm.onHandQty || 0);
              const adjustedQty = Number((currentQty - item.issuedQty).toFixed(3));
              const difference = Number((adjustedQty - currentQty).toFixed(3));
              return {
                itemType: "RAW_MATERIAL",
                rawMaterialId: item.rawMaterialId,
                storeId: item.storeId || rm.storeId,
                currentQty,
                adjustedQty,
                difference,
                remarks: item.remarks || `Daily production issue for ${date}`,
              };
            }),
          },
        },
      });

      for (const { rm, item } of rmData) {
        const storeToUse = item.storeId || rm.storeId;
        await tx.rawMaterial.update({
          where: { rawMaterialId: item.rawMaterialId },
          data: {
            onHandQty: { decrement: item.issuedQty },
            lastMovementAt: new Date(),
            updatedBy: userId,
          },
        });

        if (storeToUse) {
          await tx.rawMaterialTransaction.create({
            data: {
              storeId: storeToUse,
              rawMaterialId: item.rawMaterialId,
              txnType: "STOCK_ADJUSTMENT_OUT",
              qty: item.issuedQty,
              txnDateTime: new Date(),
              remarks: `Daily issue ${adjustmentNumber}: ${date}`,
            },
          });
        }
      }

      return {
        adjustmentId: adjustment.id.toString(),
        adjustmentNumber: adjustment.adjustmentNumber,
        date,
        itemsIssued: rmData.length,
      };
    }, { timeout: 15000, maxWait: 10000 });

    try {
      getIO().emit("inventory:stockUpdated", { type: "daily_rm_issue", date });
      getIO().emit("dailyPlan:rmIssued", { date, adjustmentNumber });
    } catch (_) {}

    return result;
  }

  // ── Check whether a week already has daily plans ─────────────────────────
  async checkWeek(weekStart: string): Promise<{
    exists: boolean;
    planCount: number;
    weekStart: string;
    weekEnd: string;
    machines: string[];
    statuses: string[];
    samplePlans: Array<{
      dailyPlanId: string;
      productionDate: string;
      machineName: string;
      shiftName: string;
      productName: string;
      plannedQty: number;
      status: string;
    }>;
  }> {
    const [y, m, d] = weekStart.split("-").map(Number);
    const wStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const wEnd   = new Date(Date.UTC(y, m - 1, d + 5, 23, 59, 59, 999));

    const weekEndStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d + 5).padStart(2, "0")}`;

    const plans = await prisma.dailyProductionPlan.findMany({
      where: {
        productionDate: { gte: wStart, lte: wEnd },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        productionOrder: {
          include: {
            productItem: { select: { productName: true, productCode: true } },
          },
        },
        machine: { select: { machineName: true } },
      },
      orderBy: { productionDate: "asc" },
    });

    const machineSet = new Set<string>();
    const statusSet  = new Set<string>();
    plans.forEach((p) => {
      if (p.machine?.machineName) machineSet.add(p.machine.machineName);
      statusSet.add(p.status);
    });

    const samplePlans = plans.slice(0, 5).map((p) => ({
      dailyPlanId:     p.dailyPlanId,
      productionDate:  p.productionDate.toISOString().split("T")[0],
      machineName:     p.machine?.machineName ?? p.machineId,
      shiftName:       (p.shiftId === "NIGHT" ? "Night Shift" : p.shiftId === "DAY" ? "Day Shift" : p.shiftId),
      productName:     p.productionOrder?.productItem?.productName ?? "",
      plannedQty:      Number(p.plannedQty ?? 0),
      status:          p.status,
    }));

    return {
      exists:     plans.length > 0,
      planCount:  plans.length,
      weekStart,
      weekEnd:    weekEndStr,
      machines:   Array.from(machineSet),
      statuses:   Array.from(statusSet),
      samplePlans,
    };
  }
}

export default new DailyPlanService();

