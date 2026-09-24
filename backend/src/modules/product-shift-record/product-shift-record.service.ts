import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateRecordInput } from "./product-shift-record.validation";

class ProductShiftRecordService {
  async create(data: CreateRecordInput) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const currentCapacity = Number(product.capacityLitres) || 0;

    const existing = await prisma.productShiftRecord.findFirst({
      where: { isHighest: true, productId: data.productId },
      orderBy: { achievedQty: "desc" },
    });

    let createdRecord = null;

    if (!existing || Number(existing.achievedQty) < data.achievedQty) {
      createdRecord = await prisma.$transaction(async (tx) => {
        await tx.productShiftRecord.updateMany({
          where: { productId: data.productId, isHighest: true },
          data: { isHighest: false },
        });

        return tx.productShiftRecord.create({
          data: {
            productId: data.productId,
            productionOrderId: data.productionOrderId,
            machineId: data.machineId,
            shiftId: data.shiftId,
            achievedQty: data.achievedQty,
            targetQty: data.targetQty,
            operatorIds: data.operatorIds || null,
            recordedDate: new Date(),
            isHighest: true,
          },
          include: {
            product: { select: { productName: true, productCode: true } },
            machine: { select: { machineName: true } },
            productionOrder: { select: { productionOrderId: true } },
          },
        });
      });
    }

    if (data.achievedQty > currentCapacity) {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: data.productId },
          data: { capacityLitres: data.achievedQty },
        });

        await tx.productCapacityHistory.create({
          data: {
            productId: data.productId,
            previousCapacity: currentCapacity,
            newCapacity: data.achievedQty,
            productionDate: new Date(),
            machineId: data.machineId,
            shiftId: data.shiftId,
            productionOrderId: data.productionOrderId,
            targetQty: data.targetQty,
            actualQty: data.achievedQty,
            achievementPct: data.targetQty > 0 ? (data.achievedQty / data.targetQty) * 100 : 0,
            operators: data.operatorIds || null,
          },
        });
      });
    }

    return createdRecord
      ? {
          ...createdRecord,
          shift: {
            shiftCode: createdRecord.shiftId,
            shiftName: createdRecord.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
          },
        }
      : null;
  }

  async findByProduct(productId: number) {
    const records = await prisma.productShiftRecord.findMany({
      where: { productId },
      include: {
        product: { select: { productName: true, productCode: true } },
        machine: { select: { machineName: true } },
        productionOrder: {
          select: {
            productionOrderId: true,
            producedQty: true,
            targetQty: true,
          },
        },
      },
      orderBy: { recordedDate: "desc" },
    });

    return records.map((r) => ({
      ...r,
      shift: {
        shiftCode: r.shiftId,
        shiftName: r.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
      },
    }));
  }

  async getHighestByProduct(productId: number) {
    const record = await prisma.productShiftRecord.findFirst({
      where: { productId, isHighest: true },
      include: {
        machine: { select: { machineName: true } },
      },
    });

    if (!record) return null;
    return {
      ...record,
      shift: {
        shiftCode: record.shiftId,
        shiftName: record.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
      },
    };
  }

  async syncHistoricalRecords() {
    // 0. Demote existing duplicate records so that at most ONE record per productId has isHighest: true
    const allHighest = await prisma.productShiftRecord.findMany({
      where: { isHighest: true },
      orderBy: { achievedQty: "desc" },
    });
    const seenPids = new Set<string>();
    for (const r of allHighest) {
      const pid = String(r.productId);
      if (seenPids.has(pid)) {
        await prisma.productShiftRecord.update({
          where: { id: r.id },
          data: { isHighest: false },
        });
      } else {
        seenPids.add(pid);
      }
    }

    // 1. Gather candidates from ProductCapacityHistory
    const caps = await prisma.productCapacityHistory.findMany({
      orderBy: { createdAt: "asc" },
      include: { product: true },
    });

    // 2. Gather candidates from HourlyProduction
    const hps = await prisma.hourlyProduction.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        productionOrder: { include: { productItem: true } },
      },
    });

    // Best record per PRODUCT (across all machines and all shifts)
    const bestRecords = new Map<string, {
      productId: bigint;
      productionOrderId: string;
      machineId: string;
      shiftId: string;
      achievedQty: number;
      targetQty: number;
      recordedDate: Date;
      operatorNames: string[];
    }>();

    // Scan capacity history (keyed strictly by productId)
    for (const c of caps) {
      const key = String(c.productId);
      const qty = Number(c.actualQty || c.newCapacity || 0);
      if (qty <= 0) continue;
      const prev = bestRecords.get(key);
      if (!prev || qty >= prev.achievedQty) {
        const opNames = (c.operators || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        bestRecords.set(key, {
          productId: c.productId,
          productionOrderId: c.productionOrderId || "PROD-HIST",
          machineId: c.machineId,
          shiftId: c.shiftId || "DAY",
          achievedQty: qty,
          targetQty: Number(c.targetQty || 0),
          recordedDate: c.productionDate ? new Date(c.productionDate) : new Date(),
          operatorNames: opNames,
        });
      }
    }

    // Scan hourly production (keyed strictly by productId)
    for (const h of hps) {
      const prodId = h.productionOrder?.productItemId;
      if (!prodId) continue;
      const key = String(prodId);
      const qty = Number(h.totalQtyProduced || 0);
      if (qty <= 0) continue;
      const prev = bestRecords.get(key);
      if (!prev || qty >= prev.achievedQty) {
        const opSet = new Set<string>();
        if (Array.isArray(h.hourlyEntries)) {
          (h.hourlyEntries as any[]).forEach((e) => {
            if (e.operatorName) opSet.add(e.operatorName.trim());
          });
        }
        bestRecords.set(key, {
          productId: prodId,
          productionOrderId: h.productionOrderId,
          machineId: h.machineId,
          shiftId: h.shiftId || "DAY",
          achievedQty: qty,
          targetQty: prev?.targetQty || 0,
          recordedDate: h.productionDate ? new Date(h.productionDate) : new Date(),
          operatorNames: Array.from(opSet),
        });
      }
    }

    // Match operator names to Employee table
    const allOpNames = new Set<string>();
    bestRecords.forEach((r) => r.operatorNames.forEach((n) => allOpNames.add(n)));
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { fullName: { in: Array.from(allOpNames) } },
          { empCode: { in: Array.from(allOpNames) } },
        ],
      },
    });
    const empByNameOrCode = new Map<string, typeof employees[0]>();
    employees.forEach((e) => {
      empByNameOrCode.set(e.empCode.toLowerCase(), e);
      if (e.fullName) empByNameOrCode.set(e.fullName.toLowerCase(), e);
    });

    // Write into ProductShiftRecord & ProductShiftRecordOperator (1 record per product)
    for (const best of bestRecords.values()) {
      const matched = best.operatorNames
        .map((n) => empByNameOrCode.get(n.toLowerCase()))
        .filter(Boolean) as typeof employees;

      const existing = await prisma.productShiftRecord.findFirst({
        where: {
          productId: best.productId,
          isHighest: true,
        },
        orderBy: { achievedQty: "desc" },
      });

      if (!existing || Number(existing.achievedQty) < best.achievedQty) {
        await prisma.$transaction(async (tx) => {
          // Deactivate all previous highest records for this product across all machines
          await tx.productShiftRecord.updateMany({
            where: {
              productId: best.productId,
              isHighest: true,
            },
            data: { isHighest: false },
          });

          const rec = await tx.productShiftRecord.create({
            data: {
              productId: best.productId,
              productionOrderId: best.productionOrderId,
              machineId: best.machineId,
              shiftId: best.shiftId,
              achievedQty: best.achievedQty,
              targetQty: best.targetQty,
              recordedDate: best.recordedDate,
              operatorIds: matched.map((m) => m.empCode).join(", ") || best.operatorNames.join(", "),
              isHighest: true,
            },
          });

          if (matched.length > 0) {
            await (tx as any).productShiftRecordOperator.createMany({
              data: matched.map((m) => ({
                productShiftRecordId: rec.id,
                employeeId: m.id,
              })),
              skipDuplicates: true,
            });
          }
        });
      } else {
        const opCount = await (prisma as any).productShiftRecordOperator.count({
          where: { productShiftRecordId: existing.id },
        });
        if (opCount === 0 && matched.length > 0) {
          await (prisma as any).productShiftRecordOperator.createMany({
            data: matched.map((m) => ({
              productShiftRecordId: existing.id,
              employeeId: m.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  async getLeaderboard(asOfDate?: string) {
    const totalProducts = await prisma.product.count({ where: { isActive: true } });
    const activeCount = await prisma.productShiftRecord.count({ where: { isHighest: true } });
    // Auto-sync if records are missing or if more records than products exist
    if (activeCount === 0 || activeCount > totalProducts) {
      await this.syncHistoricalRecords();
    }

    const whereClause: any = { isHighest: true };
    if (asOfDate && asOfDate !== "all") {
      const [yyyy, mm, dd] = asOfDate.split("-").map(Number);
      if (yyyy && mm && dd) {
        const endOfDay = new Date(Date.UTC(yyyy, mm - 1, dd, 23, 59, 59, 999));
        whereClause.recordedDate = { lte: endOfDay };
      }
    }

    const resetSetting = await prisma.systemSetting.findUnique({
      where: { key: "LEADERBOARD_COUNT_RESET_AT" },
    });
    const resetAt = resetSetting ? new Date(resetSetting.value) : null;

    const highestRecords = await prisma.productShiftRecord.findMany({
      where: whereClause,
      include: {
        product: { select: { id: true, productName: true, productCode: true } },
        machine: { select: { machineId: true, machineName: true } },
        operators: {
          include: {
            employee: {
              select: { id: true, empCode: true, fullName: true },
            },
          },
        },
      },
      orderBy: { achievedQty: "desc" },
    });

    // Cache employees for legacy records where operators relation is not yet linked
    const unlinkedRecords = highestRecords.filter((r) => (!r.operators || r.operators.length === 0) && r.operatorIds);
    let legacyEmpMap = new Map<string, { id: bigint; empCode: string; fullName: string | null }>();
    if (unlinkedRecords.length > 0) {
      const allTokens = unlinkedRecords
        .flatMap((r) => (r.operatorIds || "").split(",").map((s) => s.trim()))
        .filter(Boolean);
      if (allTokens.length > 0) {
        const emps = await prisma.employee.findMany({
          where: {
            OR: [
              { empCode: { in: allTokens } },
              { fullName: { in: allTokens } },
            ],
          },
          select: { id: true, empCode: true, fullName: true },
        });
        emps.forEach((e) => {
          legacyEmpMap.set(e.empCode.toLowerCase(), e);
          if (e.fullName) legacyEmpMap.set(e.fullName.toLowerCase(), e);
        });
      }
    }

    const empMap = new Map<string, {
      employeeId: string;
      empNo: string;
      empCode: string;
      name: string;
      fullName: string;
      total: number;
      records: Array<{
        productShiftRecordId: string;
        productId: string;
        productName: string;
        productCode: string;
        machineId: string;
        machineName: string;
        achievedQty: number;
        targetQty: number;
        shiftId: string;
        recordedDate: string;
      }>;
    }>();

    for (const rec of highestRecords) {
      let linkedEmps: Array<{ id: bigint; empCode: string; fullName: string | null }> = [];
      if (rec.operators && rec.operators.length > 0) {
        linkedEmps = rec.operators.map((o) => o.employee).filter(Boolean);
      } else if (rec.operatorIds) {
        const tokens = rec.operatorIds.split(",").map((s) => s.trim().toLowerCase());
        tokens.forEach((t) => {
          const matched = legacyEmpMap.get(t);
          if (matched) linkedEmps.push(matched);
        });
      }

      // Record only increments leaderboard count if achieved after reset timestamp
      const isCountable = !resetAt || new Date(rec.createdAt) > resetAt;

      for (const emp of linkedEmps) {
        const empKey = String(emp.id);
        if (!empMap.has(empKey)) {
          empMap.set(empKey, {
            employeeId: empKey,
            empNo: emp.empCode || "N/A",
            empCode: emp.empCode || "N/A",
            name: emp.fullName || "Unnamed",
            fullName: emp.fullName || "Unnamed",
            total: 0,
            records: [],
          });
        }
        const item = empMap.get(empKey)!;
        if (isCountable) {
          item.total += 1;
        }
        item.records.push({
          productShiftRecordId: String(rec.id),
          productId: String(rec.productId),
          productName: rec.product?.productName || "Unknown Product",
          productCode: rec.product?.productCode || "",
          machineId: rec.machineId,
          machineName: rec.machine?.machineName || rec.machineId,
          achievedQty: Number(rec.achievedQty),
          targetQty: Number(rec.targetQty),
          shiftId: rec.shiftId,
          recordedDate: rec.recordedDate ? rec.recordedDate.toISOString().split("T")[0] : "",
        });
      }
    }

    const sorted = Array.from(empMap.values())
      .sort((a, b) => b.total - a.total || a.empCode.localeCompare(b.empCode))
      .map((row, index) => ({
        sNo: index + 1,
        ...row,
      }));

    return {
      asOfDate: asOfDate || new Date().toISOString().split("T")[0],
      totalActiveRecords: highestRecords.length,
      lastResetAt: resetSetting?.value || null,
      leaderboard: sorted,
    };
  }

  async resetLeaderboardCounts() {
    const now = new Date().toISOString();
    await prisma.systemSetting.upsert({
      where: { key: "LEADERBOARD_COUNT_RESET_AT" },
      update: { value: now },
      create: { key: "LEADERBOARD_COUNT_RESET_AT", value: now },
    });
    return { resetAt: now };
  }
}

export default new ProductShiftRecordService();
