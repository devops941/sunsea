import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateHourlyProductionInput, UpdateHourlyProductionInput } from "./hourly-production.validation";
import oeeService from "../oee/oee.service";
import { getIO } from "../../socket/socket";
import dailyPlanService from "../daily-production-plan/daily-plan.service";

/** Normalize UOM aliases to canonical short form (mirrors frontend normalizeUom) */
function normalizeUom(uom: string): string {
  const u = (uom || "").trim().toLowerCase();
  if (u === "kilogram" || u === "kilograms") return "kg";
  if (u === "gram" || u === "grams") return "g";
  if (u === "ton" || u === "tonne" || u === "tonnes" || u === "tons") return "t";
  if (u === "liter" || u === "litre" || u === "liters" || u === "litres" || u === "ltr") return "l";
  if (u === "milliliter" || u === "millilitre" || u === "milliliters" || u === "millilitres" || u === "ml") return "ml";
  if (u === "meter" || u === "meters" || u === "metre" || u === "metres") return "m";
  if (u === "centimeter" || u === "centimetre" || u === "centimeters" || u === "centimetres") return "cm";
  if (u === "millimeter" || u === "millimetre" || u === "millimeters" || u === "millimetres") return "mm";
  if (u === "pcs" || u === "piece" || u === "pieces" || u === "ea" || u === "each") return "pcs";
  if (u === "box" || u === "boxes") return "box";
  if (u === "dozen" || u === "dz") return "dz";
  return u;
}

/** Convert qty from selectedUom to the raw material's baseUom (primary unit) */
function convertToBaseUom(qty: number, selectedUom: string, baseUomStr: string): number {
  if (!baseUomStr || !selectedUom) return qty;
  const primary = normalizeUom(baseUomStr.split(",")[0]);
  const selected = normalizeUom(selectedUom);
  if (primary === selected) return qty;

  // Weight: kg ↔ g ↔ t
  if (primary === "kg" && selected === "g") return qty / 1000;
  if (primary === "kg" && selected === "t") return qty * 1000;
  if (primary === "g" && selected === "kg") return qty * 1000;
  if (primary === "g" && selected === "t") return qty * 1_000_000;
  if (primary === "t" && selected === "kg") return qty / 1000;
  if (primary === "t" && selected === "g") return qty / 1_000_000;

  // Volume: l ↔ ml
  if (primary === "l" && selected === "ml") return qty / 1000;
  if (primary === "ml" && selected === "l") return qty * 1000;

  // Length: m ↔ cm ↔ mm
  if (primary === "m" && selected === "cm") return qty / 100;
  if (primary === "m" && selected === "mm") return qty / 1000;
  if (primary === "cm" && selected === "m") return qty * 100;
  if (primary === "cm" && selected === "mm") return qty / 10;
  if (primary === "mm" && selected === "m") return qty * 1000;
  if (primary === "mm" && selected === "cm") return qty * 10;

  // Count: pcs ↔ dz ↔ box
  if (primary === "dz" && selected === "pcs") return qty / 12;
  if (primary === "pcs" && selected === "dz") return qty * 12;
  if (primary === "box" && selected === "pcs") return qty / 12;
  if (primary === "pcs" && selected === "box") return qty * 12;

  return qty;
}

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
    where: { 
      productionOrderId,
    },
    _sum: {
      totalQtyProduced: true,
      totalRejectQty: true,
      totalScrapQty: true,
    }
  });

  const order = await tx.productionOrder.findUnique({ where: { productionOrderId } });
  if (!order) return;

  let newStatus = order.status || "IN_PROGRESS";

  const totalProduced = Number(aggregates._sum.totalQtyProduced || 0);
  const totalReject = Number(aggregates._sum.totalRejectQty || 0);
  const totalScrap = Number(aggregates._sum.totalScrapQty || 0);
  // Net Good Quantity Produced = total produced minus reject quantity
  const goodProduced = Math.max(0, totalProduced - totalReject);
  const targetQty = Number(order.targetQty || 0);

  // Check total dispatched so far for this PO
  const allDispatches = await tx.goodsDispatchItem.aggregate({
    where: {
      productionOrderId,
      dispatch: { status: { notIn: ["GATE_REJECTED", "STORE_REJECTED"] } },
    },
    _sum: { dispatchQty: true },
  });
  const totalDispatched = Number(allDispatches._sum?.dispatchQty || 0);

  // If target is met or exceeded, mark as COMPLETED
  if (targetQty > 0 && goodProduced >= targetQty) {
    if (totalDispatched >= targetQty) {
      newStatus = "DISPATCHED";
    } else if (["READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED"].includes(newStatus)) {
      // Target met but not fully dispatched → READY_FOR_DISPATCH
      newStatus = "READY_FOR_DISPATCH";
    } else {
      newStatus = "COMPLETED";
    }
  } else if (goodProduced > 0) {
    if (goodProduced > totalDispatched && newStatus === "DISPATCHED") {
      newStatus = "PARTIAL_COMPLETED";
    } else if (!["COMPLETED", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED"].includes(newStatus)) {
      newStatus = "IN_PROGRESS";
    }
  }

  await tx.productionOrder.update({
    where: { productionOrderId },
    data: {
      producedQty: goodProduced,
      rejectedQty: totalReject,
      scrapQty: totalScrap,
      status: newStatus,
    }
  });

  // Automatically mark linked WeeklyMachineProgram records as COMPLETED when target is met
  if (newStatus === "COMPLETED") {
    await tx.weeklyMachineProgram.updateMany({
      where: { productionOrderId },
      data: { status: "COMPLETED" },
    }).catch(() => {});
  }
}

class HourlyProductionService {
  async validateHourlyEntry(data: any, userId: string = "SYSTEM") {
    // 1. Verify production order exists
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (!order) {
      throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
    }

    // 2. Entry with/without Daily Plan
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
      // Guard against a stale/mismatched dailyPlanId being carried over for a different
      // product (e.g. an update payload that changes productionOrderId without also
      // supplying the matching plan) — this would otherwise feed a wrong-product plan into
      // the capacity-high check and forward target propagation below.
      if (dailyPlan.productionOrderId !== data.productionOrderId) {
        throw new ApiError(
          400,
          `Daily Plan ${data.dailyPlanId} belongs to Production Order ${dailyPlan.productionOrderId}, not ${data.productionOrderId}.`
        );
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

      // No explicit dailyPlanId and no existing plan for this exact slot: if this product
      // is already assigned to the machine's week (via WeeklyMachineProgram), auto-create a
      // plan on the fly. This lets a shift split its remaining hours onto a second
      // week-assigned product without requiring the planner to pre-add it via the board.
      if (!dailyPlan) {
        dailyPlan = await dailyPlanService.autoCreateSecondaryPlan(
          data.productionOrderId, data.machineId, data.shiftId, prodDate, userId
        );
      }
    }

    if (dailyPlan) {
      const blockedStatuses = ["CANCELLED", "CLOSED"];
      if (blockedStatuses.includes(dailyPlan.status.toUpperCase())) {
        throw new ApiError(400, `Hourly Production cannot be entered against a ${dailyPlan.status} Daily Plan.`);
      }

      // If status was PLANNED or PENDING, automatically transition to IN_PROGRESS when hourly production starts
      if (["PLANNED", "PENDING"].includes(dailyPlan.status.toUpperCase())) {
        await prisma.dailyProductionPlan.update({
          where: { dailyPlanId: dailyPlan.dailyPlanId },
          data: { status: "IN_PROGRESS" }
        }).catch(() => {});
      }

      // Auto-link dailyPlanId
      data.dailyPlanId = dailyPlan.dailyPlanId;
    }

    let weeklyProgram = null;
    if (dailyPlan && dailyPlan.weeklyProgramId) {
      weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
        where: { weeklyProgramId: dailyPlan.weeklyProgramId }
      });
    }

    if (!weeklyProgram && !dailyPlan) {
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

    return { order, weeklyProgram, dailyPlan };
  }

  async checkForNewCapacityHigh(tx: any, data: any, prodDate: Date, dailyPlan: any, shiftTotalProduced: number, hourlyEntriesList?: any[]) {
    const order = await tx.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
      include: { productItem: true }
    });
    if (!order) return { newHighReached: false };

    const productId = order.productItemId;
    const shiftActualProduction = Math.round(Number(shiftTotalProduced || 0));

    // Get the all-time highest record for THIS PRODUCT across all machines
    const currentHighestRecord = await tx.productShiftRecord.findFirst({
      where: {
        productId,
        isHighest: true,
      },
      orderBy: { achievedQty: "desc" },
    });

    const currentCapacity = currentHighestRecord
      ? Math.round(Number(currentHighestRecord.achievedQty))
      : Math.round(Number(order.productItem?.capacityLitres || 0));

    if (shiftActualProduction > 0 && (currentCapacity === 0 || shiftActualProduction > currentCapacity)) {
      // 1. Gather all operators involved in this shift
      const operatorNameSet = new Set<string>();
      const operatorEmpIdSet = new Set<bigint>();

      // From hourly entries
      if (Array.isArray(hourlyEntriesList)) {
        hourlyEntriesList.forEach((e: any) => {
          if (e.operatorName && typeof e.operatorName === "string") {
            e.operatorName.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((name: string) => operatorNameSet.add(name));
          }
          if (e.operatorId) {
            try {
              const parsed = BigInt(e.operatorId);
              operatorEmpIdSet.add(parsed);
            } catch (_) {}
          }
        });
      }

      // From daily plan selectedOperatorIds
      if (dailyPlan?.selectedOperatorIds) {
        try {
          const opIds = String(dailyPlan.selectedOperatorIds).split(",").map((id: string) => id.trim()).filter(Boolean);
          opIds.forEach((id: string) => {
            try {
              operatorEmpIdSet.add(BigInt(id));
            } catch (_) {}
          });
        } catch (err) {
          console.error("Failed to parse operator ids", err);
        }
      }

      // Match employees by ID or Name or EmpCode
      const empOrConditions: any[] = [];
      if (operatorEmpIdSet.size > 0) {
        empOrConditions.push({ id: { in: Array.from(operatorEmpIdSet) } });
      }
      if (operatorNameSet.size > 0) {
        const names = Array.from(operatorNameSet);
        empOrConditions.push({ fullName: { in: names } });
        empOrConditions.push({ empCode: { in: names } });
      }

      const matchedEmployees = empOrConditions.length > 0
        ? await tx.employee.findMany({
            where: { OR: empOrConditions },
            select: { id: true, empCode: true, fullName: true },
          })
        : [];

      matchedEmployees.forEach((e: any) => {
        if (e.fullName) operatorNameSet.add(e.fullName.trim());
      });

      const operatorNames = Array.from(operatorNameSet).join(", ");
      const operatorCodes = matchedEmployees.map((e: any) => e.empCode).join(", ");
      const machine = await tx.machine.findUnique({ where: { machineId: data.machineId } });
      const shiftName = data.shiftId === "NIGHT" ? "Night Shift" : "Day Shift";

      // 2. Create Capacity History record
      await tx.productCapacityHistory.create({
        data: {
          productId,
          previousCapacity: currentCapacity,
          newCapacity: shiftActualProduction,
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          productionOrderId: data.productionOrderId,
          targetQty: currentCapacity > 0 ? currentCapacity : Number(dailyPlan?.plannedQty || 0),
          actualQty: shiftActualProduction,
          achievementPct: currentCapacity > 0 ? (shiftActualProduction / currentCapacity) * 100 : 100,
          operators: operatorNames || null,
          updatedBy: "SYSTEM_OEE",
        },
      });

      // Keep only latest 2 records (CURRENT and 1 PREVIOUS) for this machine
      const existingHistory = await tx.productCapacityHistory.findMany({
        where: { productId, machineId: data.machineId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (existingHistory.length > 2) {
        const idsToDelete = existingHistory.slice(2).map((r: any) => r.id);
        await tx.productCapacityHistory.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // 3. Mark previous active highest records for THIS PRODUCT across all machines as isHighest: false
      // This ensures that when a new high is hit for this product, previous record holders lose the title
      await tx.productShiftRecord.updateMany({
        where: {
          productId,
          isHighest: true,
        },
        data: { isHighest: false },
      });

      // 4. Create new ProductShiftRecord with isHighest: true
      const newShiftRecord = await tx.productShiftRecord.create({
        data: {
          productId,
          productionOrderId: data.productionOrderId,
          machineId: data.machineId,
          shiftId: data.shiftId,
          achievedQty: shiftActualProduction,
          targetQty: currentCapacity > 0 ? currentCapacity : Number(dailyPlan?.plannedQty || 0),
          recordedDate: prodDate,
          operatorIds: operatorCodes || operatorNames || null,
          isHighest: true,
        },
      });

      // 5. Link all involved shift operators in ProductShiftRecordOperator
      if (matchedEmployees.length > 0) {
        await (tx as any).productShiftRecordOperator.createMany({
          data: matchedEmployees.map((emp: any) => ({
            productShiftRecordId: newShiftRecord.id,
            employeeId: emp.id,
          })),
          skipDuplicates: true,
        });
      }

      // 6. Update Product table with new capacity
      await tx.product.update({
        where: { id: productId },
        data: { capacityLitres: shiftActualProduction },
      });

      // 4. Forward Target Propagation: Update future / unstarted shifts for this machine and product
      // Only affects unstarted shifts (PLANNED or DRAFT with 0 production logged)
      const unstartedPlans = await tx.dailyProductionPlan.findMany({
        where: {
          machineId: data.machineId,
          productionOrder: { productItemId: productId },
          status: { in: ["PLANNED", "DRAFT"] },
          dailyPlanId: { not: dailyPlan?.dailyPlanId || "" },
          productionDate: { gte: prodDate },
          hourlyProductions: { none: { totalQtyProduced: { gt: 0 } } },
        },
      });

      const curDateStr = prodDate.toISOString().split("T")[0];
      for (const plan of unstartedPlans) {
        const planDateStr = plan.productionDate.toISOString().split("T")[0];
        // If on the same date, skip if it matches the current shift
        if (planDateStr === curDateStr && plan.shiftId === data.shiftId) {
          continue;
        }

        await tx.dailyProductionPlan.update({
          where: { dailyPlanId: plan.dailyPlanId },
          data: { plannedQty: shiftActualProduction },
        });

        if (plan.weeklyProgramId) {
          await tx.weeklyMachineProgram.update({
            where: { weeklyProgramId: plan.weeklyProgramId },
            data: { plannedQty: shiftActualProduction },
          }).catch(() => {});
        }
      }

      return {
        newHighReached: true,
        productId,
        newHighDetails: {
          productId: Number(productId),
          date: prodDate.toISOString().split("T")[0],
          machineId: data.machineId,
          machineName: machine?.machineName || data.machineId,
          shiftId: data.shiftId,
          shiftName: shiftName,
          operators: operatorNames || "N/A",
          newCapacity: shiftActualProduction,
          previousCapacity: currentCapacity,
        }
      };
    }

    return { newHighReached: false };
  }

  /**
   * Main Upsert Method: creates or updates the single parent record for
   * (productionOrderId, productionDate, shiftId, machineId) with hourlyEntries array.
   */
  async upsertHourlyProduction(data: any, userId: string = "SYSTEM") {
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const { weeklyProgram, dailyPlan } = await this.validateHourlyEntry(data, userId);

    return prisma.$transaction(async (tx) => {
      // 1. Fetch existing parent record
      const existing = await tx.hourlyProduction.findUnique({
        where: {
          productionOrderId_productionDate_shiftId_machineId: {
            productionOrderId: data.productionOrderId,
            productionDate: prodDate,
            shiftId: data.shiftId,
            machineId: data.machineId,
          }
        },
        include: {
          productionOrder: true,
        }
      });

      // Guard: once a shift is COMPLETED it is locked — no editing allowed
      if (existing && existing.status === "COMPLETED") {
        throw new ApiError(
          400,
          `Shift production for PO ${data.productionOrderId} on ${data.productionDate} (Shift: ${data.shiftId}, Machine: ${data.machineId}) is already COMPLETED and cannot be edited. Contact a supervisor if a correction is needed.`
        );
      }

      // 2. Construct / Merge hourlyEntries array
      let existingEntries: any[] = [];
      let existingDraftWastages: any[] = [];
      if (existing && Array.isArray(existing.hourlyEntries)) {
        existingEntries = [...(existing.hourlyEntries as any[])];
        existingDraftWastages = (existingEntries[0] as any)?.draftWastages || [];
      }

      const entriesMap = new Map<number, any>();
      existingEntries.forEach(entry => {
        entriesMap.set(Number(entry.hourIndex), entry);
      });

      if (data.hourlyEntries && Array.isArray(data.hourlyEntries)) {
        // Full or partial array provided
        for (const entry of data.hourlyEntries) {
          const hIdx = Number(entry.hourIndex);
          if (hIdx !== undefined && !isNaN(hIdx)) {
            entriesMap.set(hIdx, {
              hourIndex: hIdx,
              qtyProduced: Number(entry.qtyProduced ?? 0),
              rejectQty: Number(entry.rejectQty ?? 0),
              scrapQty: Number(entry.scrapQty ?? 0),
              downtime: Number(entry.downtime ?? 0),
              runtimeMinutes: Number(entry.runtimeMinutes ?? 60),
              remarks: entry.remarks ?? null,
              downtimeReason: entry.downtimeReason ?? null,
              rejectReason: entry.rejectReason ?? null,
              scrapReason: entry.scrapReason ?? null,
              operatorId: entry.operatorId ? String(entry.operatorId) : null,
              operatorName: entry.operatorName ?? null,
              operationName: entry.operationName ?? null,
              status: entry.status || (Number(entry.qtyProduced ?? 0) > 0 ? "PRODUCTION" : Number(entry.downtime ?? 0) > 0 ? "DOWNTIME" : "PENDING"),
              updatedAt: new Date().toISOString(),
              createdAt: entriesMap.get(hIdx)?.createdAt || new Date().toISOString(),
            });
          }
        }
      } else if (data.hourIndex !== undefined) {
        // Single hour update (backwards compatibility)
        const hIdx = Number(data.hourIndex);
        entriesMap.set(hIdx, {
          hourIndex: hIdx,
          qtyProduced: Number(data.qtyProduced ?? 0),
          rejectQty: Number(data.rejectQty ?? 0),
          scrapQty: Number(data.scrapQty ?? 0),
          downtime: Number(data.downtime ?? 0),
          runtimeMinutes: Number(data.runtimeMinutes ?? 60),
          remarks: data.remarks ?? null,
          downtimeReason: data.downtimeReason ?? null,
          rejectReason: data.rejectReason ?? null,
          scrapReason: data.scrapReason ?? null,
          operatorId: data.operatorId ? String(data.operatorId) : null,
          operatorName: data.operatorName ?? null,
          operationName: data.operationName ?? null,
          status: data.status || (Number(data.qtyProduced ?? 0) > 0 ? "PRODUCTION" : Number(data.downtime ?? 0) > 0 ? "DOWNTIME" : "PENDING"),
          updatedAt: new Date().toISOString(),
          createdAt: entriesMap.get(hIdx)?.createdAt || new Date().toISOString(),
        });
      }

      // Convert to sorted array and eliminate duplicate hour indexes
      const finalHourlyEntries = Array.from(entriesMap.values()).sort((a, b) => a.hourIndex - b.hourIndex);

      const draftWastagesToSave = (data.wastages && Array.isArray(data.wastages) && data.wastages.length > 0)
        ? data.wastages
        : existingDraftWastages;

      if (finalHourlyEntries.length > 0 && draftWastagesToSave.length > 0) {
        (finalHourlyEntries[0] as any).draftWastages = draftWastagesToSave;
      }

      // Compute aggregates
      const totalQtyProduced = finalHourlyEntries.reduce((s, e) => s + Number(e.qtyProduced || 0), 0);
      const totalRejectQty = finalHourlyEntries.reduce((s, e) => s + Number(e.rejectQty || 0), 0);
      const totalScrapQty = (data.totalScrapQty !== undefined && data.totalScrapQty !== null && data.totalScrapQty !== "")
        ? Number(data.totalScrapQty)
        : (data.scrapQty !== undefined && data.scrapQty !== null && data.scrapQty !== "")
        ? Number(data.scrapQty)
        : (existing?.totalScrapQty !== undefined && Number(existing.totalScrapQty) > 0)
        ? Number(existing.totalScrapQty)
        : finalHourlyEntries.reduce((s, e) => s + Number(e.scrapQty || 0), 0);
      const totalDowntime = finalHourlyEntries.reduce((s, e) => s + Number(e.downtime || 0), 0);

      const isShiftFinal = Boolean(data.isCompleted || data.stopPlanEarly);

      // 3. Upsert the parent record
      const parentRecord = await tx.hourlyProduction.upsert({
        where: {
          productionOrderId_productionDate_shiftId_machineId: {
            productionOrderId: data.productionOrderId,
            productionDate: prodDate,
            shiftId: data.shiftId,
            machineId: data.machineId,
          }
        },
        update: {
          dailyPlanId: data.dailyPlanId || existing?.dailyPlanId || dailyPlan?.dailyPlanId || null,
          hourlyEntries: finalHourlyEntries,
          totalQtyProduced,
          totalRejectQty,
          totalScrapQty,
          totalDowntime,
          remarks: data.remarks !== undefined ? data.remarks : existing?.remarks,
          operatorId: data.operatorId !== undefined ? (data.operatorId ? String(data.operatorId) : null) : existing?.operatorId,
          status: isShiftFinal ? "COMPLETED" : (totalQtyProduced > 0 ? "IN_PROGRESS" : "PENDING"),
        },
        create: {
          dailyPlanId: data.dailyPlanId || dailyPlan?.dailyPlanId || null,
          productionOrderId: data.productionOrderId,
          productionDate: prodDate,
          shiftId: data.shiftId,
          machineId: data.machineId,
          hourlyEntries: finalHourlyEntries,
          totalQtyProduced,
          totalRejectQty,
          totalScrapQty,
          totalDowntime,
          remarks: data.remarks || null,
          operatorId: data.operatorId ? String(data.operatorId) : null,
          status: isShiftFinal ? "COMPLETED" : (totalQtyProduced > 0 ? "IN_PROGRESS" : "PENDING"),
        },
        include: {
          productionOrder: true,
        }
      });

      // 4. Sync production order target & produced quantities (aggregates ONLY status: 'COMPLETED' records)
      await syncProductionOrderQuantities(tx, data.productionOrderId);

      // 5. Check shift duration and plan completion (Static 12-hour shifts)
      const totalHours = 12;

      if (isShiftFinal) {
        if (weeklyProgram) {
          await tx.weeklyMachineProgram.update({
            where: { weeklyProgramId: weeklyProgram.weeklyProgramId },
            data: { status: "COMPLETED" },
          }).catch(() => {});
        }
        if (dailyPlan?.dailyPlanId && dailyPlan.status !== "COMPLETED") {
          await tx.dailyProductionPlan.update({
            where: { dailyPlanId: dailyPlan.dailyPlanId },
            data: { status: "COMPLETED" },
          }).catch(() => {});
        }
      } else {
        if (weeklyProgram && weeklyProgram.status !== "COMPLETED" && weeklyProgram.status !== "IN_PROGRESS") {
          await tx.weeklyMachineProgram.update({
            where: { weeklyProgramId: weeklyProgram.weeklyProgramId },
            data: { status: "IN_PROGRESS" },
          }).catch(() => {});
        }
        if (dailyPlan?.dailyPlanId && dailyPlan.status === "PLANNED") {
          await tx.dailyProductionPlan.update({
            where: { dailyPlanId: dailyPlan.dailyPlanId },
            data: { status: "IN_PROGRESS" },
          }).catch(() => {});
        }
      }

      // 6. Process inline wastages & raw material returns into a single StockAdjustment record
      // ONLY executed on finalized shift submission (Submit Shift Production), NEVER on intermediate draft saves!
      const validWastages = (data.wastages && Array.isArray(data.wastages))
        ? data.wastages.filter((w: any) => w.targetWastageProductId && w.quantity && Number(w.quantity) > 0)
        : [];
      const validRmReturns = (data.rawMaterialsUsed && Array.isArray(data.rawMaterialsUsed))
        ? data.rawMaterialsUsed.filter((r: any) => r.rawMaterialId && r.quantity && Number(r.quantity) > 0)
        : [];

      if (isShiftFinal && (validWastages.length > 0 || validRmReturns.length > 0)) {
        const latestSA = await tx.stockAdjustment.findFirst({ orderBy: { id: 'desc' } });
        const saNextId = latestSA ? Number(latestSA.id) + 1 : 1;
        const adjustmentNumber = `SA${String(saNextId).padStart(4, "0")}`;

        const saRecord = await tx.stockAdjustment.create({
          data: {
            adjustmentNumber,
            adjustmentDate: new Date(),
            adjustmentType: "STOCK_INCREASE",
            type: "SYSTEM",
            autoGenerated: true,
            sourceDocument: "HOURLY_PRODUCTION",
            sourceDocId: String(parentRecord.hourlyProductionId),
            productionOrderId: data.productionOrderId,
            reason: `Hourly Production Log (Wastages & Returns) for PO: ${data.productionOrderId}`,
            status: "APPROVED",
            approvedBy: userId,
            approvedAt: new Date(),
            createdBy: userId,
          }
        });

        for (const wastage of validWastages) {
          const targetProduct = await tx.rawMaterial.findUnique({
            where: { rawMaterialId: wastage.targetWastageProductId },
            include: { category: true }
          });

          const isScrapOrWastage = Boolean(
            (targetProduct?.itemType || "").toUpperCase() === "WASTAGE" ||
            (targetProduct?.itemType || "").toUpperCase() === "SCRAP" ||
            (targetProduct?.category?.name || "").toLowerCase().includes("wastage") ||
            (targetProduct?.category?.name || "").toLowerCase().includes("scrap") ||
            (targetProduct?.materialName || "").toLowerCase().includes("wastage") ||
            (targetProduct?.materialName || "").toLowerCase().includes("scrap") ||
            (wastage.targetWastageProductId || "").toLowerCase().includes("wastage") ||
            (wastage.targetWastageProductId || "").toLowerCase().includes("scrap")
          );

          const itemType = isScrapOrWastage ? "WASTAGE" : "RAW_MATERIAL";
          const txnType = isScrapOrWastage ? "WASTAGE_RECEIPT" : "RETURN";
          const wastageType = isScrapOrWastage ? "SCRAP" : "RAW_MATERIAL_WASTE";

          const latestWastage = await tx.productionWastage.findFirst({
            orderBy: { id: 'desc' }
          });
          const nextId = latestWastage ? Number(latestWastage.id) + 1 : 1;
          const wastageNo = `PW${String(nextId).padStart(4, "0")}`;

          const entryRemarks = wastage.narration?.trim() || (isScrapOrWastage ? `Wastage entry #${wastageNo}` : `Raw Material Return #${wastageNo}`);

          await tx.productionWastage.create({
            data: {
              wastageNo,
              wastageDate: prodDate,
              productionOrderId: data.productionOrderId,
              hourlyProductionId: parentRecord.hourlyProductionId,
              machineId: data.machineId,
              shiftId: data.shiftId,
              productId: parentRecord.productionOrder?.productItemId ?? BigInt(1),
              targetWastageProductId: wastage.targetWastageProductId,
              storeId: wastage.storeId,
              wastageType: wastageType as any,
              quantity: wastage.quantity,
              uom: wastage.selectedUom || wastage.uom || "kg",
              status: "APPROVED",
              createdBy: userId,
              approvedBy: userId,
              approvedAt: new Date(),
              remarks: entryRemarks
            }
          });

          if (targetProduct) {
            const rmBaseUom = String(targetProduct.baseUom || "kg");
            const selectedUom = wastage.selectedUom || wastage.baseUom || rmBaseUom;
            const convertedQty = convertToBaseUom(Number(wastage.quantity), selectedUom, rmBaseUom);

            const currentQty = Number(targetProduct.onHandQty ?? 0);
            const newOnHand = currentQty + convertedQty;

            await tx.rawMaterial.update({
              where: { rawMaterialId: wastage.targetWastageProductId },
              data: {
                onHandQty: { increment: convertedQty },
                lastMovementAt: new Date()
              }
            });

            await tx.rawMaterialTransaction.create({
              data: {
                storeId: wastage.storeId || targetProduct.storeId || "STORE-001",
                rawMaterialId: wastage.targetWastageProductId,
                txnType: txnType,
                qty: convertedQty,
                remarks: isScrapOrWastage
                  ? `Received from Hourly Production Auto-log #${wastageNo}`
                  : `Raw Material Return from Hourly Production #${wastageNo}`,
                productionOrderId: data.productionOrderId,
              }
            });

            await tx.stockAdjustmentItem.create({
              data: {
                stockAdjustmentId: saRecord.id,
                itemType: itemType,
                rawMaterialId: wastage.targetWastageProductId,
                storeId: wastage.storeId || targetProduct.storeId,
                currentQty,
                adjustedQty: newOnHand,
                difference: convertedQty,
                unitCost: Number((targetProduct as any).rate ?? 0),
                remarks: entryRemarks,
              }
            });
          }
        }

        for (const rm of validRmReturns) {
          const targetProduct = await tx.rawMaterial.findUnique({
            where: { rawMaterialId: rm.rawMaterialId }
          });

          if (targetProduct) {
            const rmBaseUom = String(targetProduct.baseUom || "kg");
            const selectedUom = rm.selectedUom || rm.uom || rmBaseUom;
            const convertedQty = convertToBaseUom(Number(rm.quantity), selectedUom, rmBaseUom);

            const currentQty = Number(targetProduct.onHandQty ?? 0);
            const newOnHand = currentQty + convertedQty;

            await tx.rawMaterial.update({
              where: { rawMaterialId: rm.rawMaterialId },
              data: {
                onHandQty: { increment: convertedQty },
                lastMovementAt: new Date()
              }
            });

            await tx.rawMaterialTransaction.create({
              data: {
                storeId: rm.storeId || targetProduct.storeId || "STORE-001",
                rawMaterialId: rm.rawMaterialId,
                txnType: "RETURN",
                qty: convertedQty,
                remarks: `Returned remaining raw materials in Hourly Production`,
                productionOrderId: data.productionOrderId,
              }
            });

            await tx.stockAdjustmentItem.create({
              data: {
                stockAdjustmentId: saRecord.id,
                itemType: "RAW_MATERIAL",
                rawMaterialId: rm.rawMaterialId,
                storeId: rm.storeId || targetProduct.storeId,
                currentQty,
                adjustedQty: newOnHand,
                difference: convertedQty,
                unitCost: Number((targetProduct as any).rate ?? 0),
                remarks: `Returned raw material in Shift Log`,
              }
            });
          }
        }
      }

      // 7. Check for capacity high - ONLY on finalized Shift Submission, NEVER on intermediate draft saves!
      // A shift whose hours are split across more than one product (e.g. the planned
      // product's run was cut short and another product took over the remaining hours)
      // never represents a clean, full-shift capacity benchmark for either product — so
      // capacity-high evaluation is skipped entirely for every product in that shift.
      const shiftGood = Math.max(0, totalQtyProduced - totalRejectQty);
      let highCheckResult: any = { newHighReached: false };
      if (isShiftFinal && shiftGood > 0) {
        const siblingRows = await tx.hourlyProduction.findMany({
          where: { machineId: data.machineId, shiftId: data.shiftId, productionDate: prodDate, totalQtyProduced: { gt: 0 } },
          select: { productionOrderId: true },
          distinct: ["productionOrderId"],
        });

        let isMultiProductShift = false;
        if (siblingRows.length > 1) {
          const siblingOrders = await tx.productionOrder.findMany({
            where: { productionOrderId: { in: siblingRows.map((r: any) => r.productionOrderId) } },
            select: { productItemId: true },
          });
          const distinctProducts = new Set(siblingOrders.map((o: any) => String(o.productItemId)));
          isMultiProductShift = distinctProducts.size > 1;
        }

        if (!isMultiProductShift) {
          highCheckResult = await this.checkForNewCapacityHigh(tx, data, prodDate, dailyPlan, shiftGood, finalHourlyEntries);
        }
      }

      return {
        ...parentRecord,
        qtyProduced: totalQtyProduced,
        rejectQty: totalRejectQty,
        scrapQty: totalScrapQty,
        downtime: totalDowntime,
        ...highCheckResult,
      };
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
        console.error("OEE snapshot recalculation failed:", e);
      }
      // Notify inventory & capacity updates
      try {
        getIO().emit("inventory:stockUpdated", { type: "hourly_production" });
        if (result.newHighReached && result.newHighDetails) {
          getIO().emit("productCapacityHistory:created", result.newHighDetails);
          getIO().emit("productShiftRecord:created", result.newHighDetails);
          getIO().emit("productShiftRecord:leaderboardUpdated", { date: data.productionDate });
          getIO().emit("dailyPlan:updated", { machineId: data.machineId });
          getIO().emit("product:updated", { productId: result.productId });
        }
      } catch (_) {}
      return result;
    });
  }

  async create(data: any, userId: string = "SYSTEM") {
    return this.upsertHourlyProduction(data, userId);
  }

  /**
   * Removes specific hour-index entries from a product's HourlyProduction row.
   * Used when an operator moves an hour-slot's production from one product to another —
   * the gaining product's upsert adds the entry, and this removes it from the product it
   * moved away from, so the hour isn't double-counted across two products.
   */
  async removeHourlyEntries(params: { productionOrderId: string; machineId: string; shiftId: string; productionDate: string; hourIndexes: number[] }) {
    const [yyyy, mm, dd] = params.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    return prisma.$transaction(async (tx) => {
      const existing = await tx.hourlyProduction.findUnique({
        where: {
          productionOrderId_productionDate_shiftId_machineId: {
            productionOrderId: params.productionOrderId,
            productionDate: prodDate,
            shiftId: params.shiftId,
            machineId: params.machineId,
          }
        },
      });
      if (!existing) return null;

      if (existing.status === "COMPLETED") {
        throw new ApiError(400, `Cannot modify shift production for PO ${params.productionOrderId} on ${params.productionDate} — it is already COMPLETED.`);
      }

      const removeSet = new Set(params.hourIndexes.map(Number));
      const remainingEntries = (Array.isArray(existing.hourlyEntries) ? existing.hourlyEntries as any[] : [])
        .filter((e: any) => !removeSet.has(Number(e.hourIndex)));

      const totalQtyProduced = remainingEntries.reduce((s, e) => s + Number(e.qtyProduced || 0), 0);
      const totalRejectQty = remainingEntries.reduce((s, e) => s + Number(e.rejectQty || 0), 0);
      const totalDowntime = remainingEntries.reduce((s, e) => s + Number(e.downtime || 0), 0);

      const updated = await tx.hourlyProduction.update({
        where: { hourlyProductionId: existing.hourlyProductionId },
        data: {
          hourlyEntries: remainingEntries,
          totalQtyProduced,
          totalRejectQty,
          totalDowntime,
          status: totalQtyProduced > 0 ? "IN_PROGRESS" : "PENDING",
        },
      });

      await syncProductionOrderQuantities(tx, params.productionOrderId);
      return updated;
    }, { timeout: 15000 });
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

    const records = await prisma.hourlyProduction.findMany({
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
        productionWastages: true,
      },
      orderBy: [
        { productionDate: "desc" },
        { hourlyProductionId: "desc" }
      ],
    });

    const operatorIds = [...new Set(records.map(r => r.operatorId).filter(Boolean))].map(id => {
      try { return BigInt(id as string); } catch (e) { return null; }
    }).filter(Boolean) as bigint[];

    let operatorMap = new Map<string, string>();
    if (operatorIds.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: operatorIds } }
      });
      employees.forEach(emp => {
        operatorMap.set(emp.id.toString(), emp.fullName || "");
      });
    }

    const enrichedRecords = await Promise.all(records.map(async (record) => {
      const { monday, dayOfWeek } = getMondayAndDayOfWeek(record.productionDate);

      let shiftPlannedQty = 0;
      let weeklyProgramStatus = null;
      let weeklyProgramId = null;

      if (record.dailyPlanId) {
        const dailyPlan = await prisma.dailyProductionPlan.findUnique({
          where: { dailyPlanId: record.dailyPlanId }
        });
        if (dailyPlan) {
          shiftPlannedQty = Number(dailyPlan.plannedQty);
          weeklyProgramStatus = dailyPlan.status;
          weeklyProgramId = dailyPlan.weeklyProgramId;
        }
      }

      if (!shiftPlannedQty) {
        const weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
          where: {
            machineId: record.machineId,
            shiftId: record.shiftId,
            weekStartDate: monday,
            dayOfWeek: dayOfWeek,
            productionOrderId: record.productionOrderId,
          },
          orderBy: {
            weeklyProgramId: "desc"
          }
        });

        if (weeklyProgram) {
          shiftPlannedQty = Number(weeklyProgram.plannedQty);
          weeklyProgramStatus = weeklyProgram.status;
          weeklyProgramId = weeklyProgram.weeklyProgramId;
        }
      }

      const totalProduced = Number(record.totalQtyProduced);
      const totalReject = Number(record.totalRejectQty);
      const totalScrap = Number(record.totalScrapQty);
      const totalDowntime = Number(record.totalDowntime);
      const goodQty = Math.max(0, totalProduced - totalReject - totalScrap);

      const entries = (Array.isArray(record.hourlyEntries) ? record.hourlyEntries : []) as any[];
      const draftWastages = (entries[0] as any)?.draftWastages || [];
      const wastagesList = (record.productionWastages && record.productionWastages.length > 0)
        ? record.productionWastages
        : draftWastages;

      return {
        ...record,
        shift: {
          shiftCode: record.shiftId,
          shiftName: record.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
          startTime: record.shiftId === "NIGHT" ? "21:00" : "09:00",
          endTime: record.shiftId === "NIGHT" ? "09:00" : "21:00",
        },
        // Top-level aliases for backwards compatibility
        qtyProduced: totalProduced,
        rejectQty: totalReject,
        scrapQty: totalScrap,
        totalScrapQty: totalScrap,
        downtime: totalDowntime,
        goodQty,
        operatorName: record.operatorId ? (operatorMap.get(record.operatorId) || record.operatorId) : null,
        shiftPlannedQty,
        weeklyProgramStatus,
        weeklyProgramId,
        hourlyEntries: entries,
        wastages: wastagesList,
        draftWastages,
      };
    }));

    return enrichedRecords;
  }

  async findById(hourlyProductionId: bigint) {
    const record = await prisma.hourlyProduction.findUnique({
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
        productionWastages: true,
      },
    });

    if (!record) {
      throw new ApiError(404, `Hourly production log with ID ${hourlyProductionId.toString()} not found`);
    }

    const entries = (Array.isArray(record.hourlyEntries) ? record.hourlyEntries : []) as any[];
    const draftWastages = (entries[0] as any)?.draftWastages || [];
    const wastagesList = (record.productionWastages && record.productionWastages.length > 0)
      ? record.productionWastages
      : draftWastages;

    return {
      ...record,
      shift: {
        shiftCode: record.shiftId,
        shiftName: record.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
        startTime: record.shiftId === "NIGHT" ? "21:00" : "09:00",
        endTime: record.shiftId === "NIGHT" ? "09:00" : "21:00",
      },
      qtyProduced: Number(record.totalQtyProduced),
      rejectQty: Number(record.totalRejectQty),
      scrapQty: Number(record.totalScrapQty),
      totalScrapQty: Number(record.totalScrapQty),
      downtime: Number(record.totalDowntime),
      goodQty: Math.max(0, Number(record.totalQtyProduced) - Number(record.totalRejectQty)),
      hourlyEntries: entries,
      wastages: wastagesList,
      draftWastages,
    };
  }

  async update(hourlyProductionId: bigint, data: UpdateHourlyProductionInput, userId: string = "SYSTEM") {
    const existing = await this.findById(hourlyProductionId);

    const merged = {
      ...data,
      productionOrderId: data.productionOrderId ?? existing.productionOrderId,
      productionDate: data.productionDate ?? existing.productionDate.toISOString().split("T")[0],
      shiftId: data.shiftId ?? existing.shiftId,
      machineId: data.machineId ?? existing.machineId,
      dailyPlanId: data.dailyPlanId !== undefined ? data.dailyPlanId : existing.dailyPlanId,
    };

    return this.upsertHourlyProduction(merged, userId);
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
