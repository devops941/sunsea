import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateProductionOrderInput, UpdateProductionOrderInput, ProductionOrderQueryInput } from "./production-order.validation";
import { Prisma } from "@prisma/client";
import { StatusSyncService } from "../../utils/status-sync.util";

/** Normalize UOM aliases to canonical short form */
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

/** Convert qty from selectedUom to baseUom (primary unit of the raw material) */
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

// ============================================================
// STATUS TRANSITION RULES (ERP Standard Manufacturing Flow)
// CREATED → READY_FOR_PLANNING ↔ WAITING_FOR_MATERIAL
//         → WEEKLY_SCHEDULED → DAILY_PLANNED
//         → IN_PRODUCTION → POST_PRODUCTION
//         → READY_FOR_DISPATCH → DISPATCHED
// ============================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["DRAFT", "WEEKLY_SCHEDULED", "CANCELLED"],
  WEEKLY_SCHEDULED: ["DRAFT", "CANCELLED"],
  CANCELLED: [],
  // Legacy (backward compat for existing orders in old statuses)
  CREATED: ["WEEKLY_SCHEDULED", "CANCELLED"],
  WAITING_FOR_MATERIAL: ["WEEKLY_SCHEDULED", "CANCELLED"],
  READY_FOR_PLANNING: ["WEEKLY_SCHEDULED", "CANCELLED"],
  DAILY_PLANNED: ["WEEKLY_SCHEDULED", "CANCELLED"],
  IN_PRODUCTION: ["POST_PRODUCTION", "CANCELLED"],
  POST_PRODUCTION: ["READY_FOR_DISPATCH", "PARTIAL_COMPLETED"],
  PARTIAL_COMPLETED: ["READY_FOR_DISPATCH", "DISPATCHED"],
  READY_FOR_DISPATCH: ["DISPATCHED"],
  DISPATCHED: [],
  PLANNED: ["WEEKLY_SCHEDULED", "CANCELLED"],
  SCHEDULED: ["WEEKLY_SCHEDULED", "CANCELLED"],
  COMPLETED: ["READY_FOR_DISPATCH", "DISPATCHED"],
};

class ProductionOrderService {

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Compute edit/delete restrictions based on linked DailyProductionPlans.
   * - nonCancelledPlans: CANCELLED / SHORT_CLOSED / STOPPED / COMPLETED are treated as finished → not blocking
   * - activePlans: PLANNED / APPROVED / IN_PROGRESS / POST_PRODUCTION → block product + qty edits
   */
  private async computeEditRestrictions(productionOrderId: string) {
    const [order, plans] = await Promise.all([
      prisma.productionOrder.findUnique({
        where: { productionOrderId },
        select: { status: true },
      }),
      prisma.dailyProductionPlan.findMany({
        where: { productionOrderId },
        select: { status: true },
      }),
    ]);

    const nonCancelledPlans = plans.filter((p) => p.status !== "CANCELLED");
    const isOrderAdvanced = order && !["DRAFT", "WEEKLY_SCHEDULED"].includes(order.status);
    const isLocked = nonCancelledPlans.length > 0 || isOrderAdvanced;

    const canEditDates = !isLocked;
    const canEditProductQty = !isLocked;
    const canDelete = !isLocked;
    const reason = nonCancelledPlans.length > 0
      ? `Assigned to ${nonCancelledPlans.length} daily plan(s)`
      : isOrderAdvanced
      ? `Order is in ${order?.status} status`
      : "";

    return { canEditDates, canEditProductQty, canDelete, reason, nonCancelledCount: nonCancelledPlans.length };
  }

  private validateStatusTransition(from: string, to: string) {
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new ApiError(
        400,
        `Invalid status transition from "${from}" to "${to}". Allowed transitions: [${allowed.join(", ")}]`
      );
    }
  }

  private async addHistory(
    tx: any,
    productionOrderId: string,
    fromStatus: string | null,
    toStatus: string,
    changedBy?: string,
    remarks?: string,
    action?: string,
    metadata?: any
  ) {
    await StatusSyncService.logHistory(
      tx,
      productionOrderId,
      fromStatus,
      toStatus,
      changedBy,
      remarks,
      action,
      metadata
    );
  }

  // ── Create ────────────────────────────────────────────────────────────────
  // STEP 1: Production Order Creation
  // - Status must be CREATED
  // - No stock movement
  // - No FG stock creation
  // - No StockAdjustment
  async create(data: CreateProductionOrderInput, userId?: string) {
    const productItemId = BigInt(data.productItemId);

    const existing = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (existing) {
      throw new ApiError(409, `Production Order with ID ${data.productionOrderId} already exists`);
    }

    const product = await prisma.product.findUnique({
      where: { id: productItemId },
      include: { productionSteps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!product) {
      throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
    }

    const weightPerPieceUsed = product.weightPerPiece ? Number(product.weightPerPiece) : 0;
    const requiredRawMaterialQty = Number(data.targetQty) * weightPerPieceUsed;

    if (data.sourceStoreId) {
      const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
      if (!store) throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
    }

    if (data.machineMachineId) {
      const machine = await prisma.machine.findUnique({ where: { machineId: data.machineMachineId } });
      if (!machine) throw new ApiError(404, `Machine with ID ${data.machineMachineId} not found`);
    }

    // Check if product has a BOM defined — warn if missing (raw material tracking will be skipped)
    const bomCount = await prisma.billOfMaterial.count({ where: { productId: productItemId } });
    const hasBom = bomCount > 0 || (Array.isArray(data.rawMaterials) && data.rawMaterials.length > 0);
    const bomWarning = !hasBom
      ? `Warning: Product "${product.productName}" has no Bill of Materials defined. Raw material consumption will NOT be tracked for this order. Please add a BOM before starting production.`
      : null;

    // ✅ STEP 1 RULE: Status is always CREATED on creation. No exceptions.
    const result = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.productionOrder.create({
        data: {
          productionOrderId: data.productionOrderId,
          orderDate: new Date(data.orderDate),
          dueDate: new Date(data.dueDate),
          productItemId,
          targetQty: data.targetQty,
          producedQty: 0,
          rejectedQty: 0,
          scrapQty: 0,
          uom: data.uom,
          priority: data.priority ?? "MEDIUM",
          orderType: data.orderType ?? "STANDARD",
          batchNo: data.batchNo,
          sourceStoreId: data.sourceStoreId,
          routingId: data.routingId,
          machineMachineId: data.machineMachineId,
          weekStartDate: (data as any).weekStartDate ? new Date((data as any).weekStartDate) : null,
          weekEndDate: (data as any).weekEndDate ? new Date((data as any).weekEndDate) : null,
          status: data.status === "DRAFT" ? "DRAFT" : "WEEKLY_SCHEDULED",
          remarks: data.remarks,
          createdBy: userId,
          weightPerPieceUsed,
          requiredRawMaterialQty,
          draftRawMaterials: data.rawMaterials as any ?? null,
          currentStepIndex: 0,
          currentProductionStep: null,
        } as any,
        include: { productItem: true },
      });

      // ✅ Log creation history
      await this.addHistory(
        tx,
        data.productionOrderId,
        null,
        data.status === "DRAFT" ? "DRAFT" : "WEEKLY_SCHEDULED",
        userId,
        data.remarks ?? "Production order created",
        "CREATE"
      );

      return createdOrder;
    }, { timeout: 15000, maxWait: 10000 });

    return { ...result, bomWarning };
  }

  // ── Check Material Availability ────────────────────────────────────────────
  // STEP 2: Automatic status transition after creation
  // CREATED → READY_FOR_PLANNING (all materials available)
  //         → WAITING_FOR_MATERIAL (some materials insufficient)
  async checkMaterialAvailability(productionOrderId: string, userId?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        productItem: {
          include: { billOfMaterials: { include: { rawMaterial: true } } },
        },
      },
    }) as any;

    if (!order) {
      throw new ApiError(404, `Production Order ${productionOrderId} not found`);
    }

    if (!["CREATED", "WAITING_FOR_MATERIAL", "READY_FOR_PLANNING", "PENDING_PLANNING"].includes(order.status)) {
      throw new ApiError(
        400,
        `Cannot check materials for a Production Order with status "${order.status}".`
      );
    }

    // Build BOM items from product's BOM
    const bomItems = order.productItem?.billOfMaterials || [];
    const targetQty = Number(order.targetQty);
    const materialStatus: Array<{
      rawMaterialId: string;
      materialName: string;
      requiredQty: number;
      availableQty: number;
      status: "AVAILABLE" | "INSUFFICIENT";
    }> = [];

    let allAvailable = true;

    // If draftRawMaterials is set, use that; otherwise use BOM
    const rawMaterialsToCheck: Array<{ rawMaterialId: string; requiredQty: number; materialName?: string }> =
      Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0
        ? (order.draftRawMaterials as any[])
        : bomItems.map((bi: any) => ({
            rawMaterialId: bi.rawMaterialId,
            requiredQty: Number(bi.requiredQuantity) * targetQty,
            materialName: bi.rawMaterial?.materialName,
          }));

    for (const rm of rawMaterialsToCheck) {
      const stock = await prisma.rawMaterial.findUnique({
        where: { rawMaterialId: rm.rawMaterialId },
      });
      const available = stock ? Number(stock.onHandQty) - Number(stock.reservedQty) : 0;
      const required = Number(rm.requiredQty);
      const isAvailable = available >= required;
      if (!isAvailable) allAvailable = false;

      materialStatus.push({
        rawMaterialId: rm.rawMaterialId,
        materialName: rm.materialName || stock?.materialName || rm.rawMaterialId,
        requiredQty: required,
        availableQty: available,
        status: isAvailable ? "AVAILABLE" : "INSUFFICIENT",
      });
    }

    const newStatus = allAvailable ? "READY_FOR_PLANNING" : "WAITING_FOR_MATERIAL";
    const previousStatus = order.status;

    await prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { productionOrderId },
        data: { status: newStatus },
      });
      await this.addHistory(
        tx,
        productionOrderId,
        previousStatus,
        newStatus,
        userId,
        allAvailable
          ? "All raw materials are available. Order is ready for weekly planning."
          : "Insufficient raw materials. Order is waiting for material replenishment.",
        "MATERIAL_CHECK",
        { materialStatus }
      );
    }, { timeout: 15000, maxWait: 10000 });

    return {
      status: newStatus,
      allAvailable,
      materialStatus,
    };
  }

  // ── Find All ──────────────────────────────────────────────────────────────
  async findAll(query: ProductionOrderQueryInput) {
    const {
      page = 1,
      pageSize = 20,
      productItemId,
      productionOrderId,
      status,
      search,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.ProductionOrderWhereInput = {};

    if (productItemId) where.productItemId = BigInt(productItemId);
    if (productionOrderId) where.productionOrderId = { contains: productionOrderId, mode: "insensitive" };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { productionOrderId: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
        { productItem: { productName: { contains: search, mode: "insensitive" } } },
        { productItem: { productCode: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) where.orderDate.gte = new Date(fromDate);
      if (toDate) where.orderDate.lte = new Date(toDate);
    }

    const [total, items] = await Promise.all([
      prisma.productionOrder.count({ where }),
      prisma.productionOrder.findMany({
        where,
        skip,
        take,
        include: { productItem: true, Machine: true },
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // Bulk fetch daily plan statuses for this page's orders (single query, no N+1)
    const orderIds = items.map((i) => i.productionOrderId);
    const [allPlans, completedAggregates] = await Promise.all([
      prisma.dailyProductionPlan.findMany({
        where: { productionOrderId: { in: orderIds } },
        select: { productionOrderId: true, status: true },
      }),
      prisma.hourlyProduction.groupBy({
        by: ["productionOrderId"],
        where: {
          productionOrderId: { in: orderIds },
        },
        _sum: {
          totalQtyProduced: true,
          totalRejectQty: true,
        }
      })
    ]);

    // Group by productionOrderId
    const plansByOrder = new Map<string, string[]>();
    allPlans.forEach((p) => {
      const arr = plansByOrder.get(p.productionOrderId) || [];
      arr.push(p.status);
      plansByOrder.set(p.productionOrderId, arr);
    });

    const completedGoodQtyMap = new Map<string, number>();
    completedAggregates.forEach((agg) => {
      const prod = Number(agg._sum.totalQtyProduced || 0);
      const rej = Number(agg._sum.totalRejectQty || 0);
      completedGoodQtyMap.set(agg.productionOrderId, Math.max(0, prod - rej));
    });

    const formattedItems = items.map((item) => {
      const statuses = plansByOrder.get(item.productionOrderId) || [];
      const nonCancelled = statuses.filter((s) => s !== "CANCELLED");
      
      const goodQty = completedGoodQtyMap.get(item.productionOrderId) ?? Number(item.producedQty || 0);
      const targetQty = Number(item.targetQty || 0);

      let effectiveStatus = item.status;
      if (targetQty > 0 && goodQty >= targetQty) {
        if (!["READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED"].includes(effectiveStatus)) {
          effectiveStatus = "COMPLETED";
        }
      }

      if (item.status !== effectiveStatus || Number(item.producedQty || 0) !== goodQty) {
        prisma.productionOrder.update({
          where: { productionOrderId: item.productionOrderId },
          data: { status: effectiveStatus, producedQty: goodQty }
        }).catch(() => {});

        if (effectiveStatus === "COMPLETED") {
          prisma.weeklyMachineProgram.updateMany({
            where: { productionOrderId: item.productionOrderId },
            data: { status: "COMPLETED" }
          }).catch(() => {});
        }
      }

      const isOrderAdvanced = !["DRAFT", "WEEKLY_SCHEDULED"].includes(effectiveStatus);
      const isLocked = nonCancelled.length > 0 || isOrderAdvanced;

      return {
        ...item,
        status: effectiveStatus,
        producedQty: goodQty,
        productItemId: item.productItemId.toString(),
        totalProducts: 1,
        totalProductionQuantity: Number(item.targetQty),
        salesOrderDetails: null,
        _editRestrictions: {
          canEditDates: !isLocked,
          canEditProductQty: !isLocked,
          canDelete: !isLocked,
          reason: nonCancelled.length > 0
            ? `Assigned to ${nonCancelled.length} daily plan(s)`
            : isOrderAdvanced
            ? `Order is in ${effectiveStatus} status`
            : "",
        },
      };
    });

    return {
      data: formattedItems,
      pagination: { total, page, pageSize, totalPages },
    };
  }

  // ── Find By ID ────────────────────────────────────────────────────────────
  async findById(productionOrderId: string) {
    const order = (await prisma.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        productItem: { include: { uom: true } },
        finishedGoodsTransactions: true,
        Machine: true,
        dailyProductionPlans: {
          include: {
            machine: true,
            hourlyProductions: true,
          },
          orderBy: [{ productionDate: "asc" }],
        },
        weeklyMachinePrograms: {
          include: {
            machine: true,
            dailyProductionPlans: {
              include: { machine: true, hourlyProductions: true },
            },
          },
        },
        goodsDispatchItems: { include: { dispatch: true, product: true } },
        productionOrderHistories: {
          orderBy: { changedAt: "asc" },
        },
      },
    })) as any;

    if (!order) {
      throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);
    }

    // Ensure producedQty strictly reflects Net Good Quantity (produced minus reject)
    const completedHpAgg = await prisma.hourlyProduction.aggregate({
      where: { productionOrderId },
      _sum: { totalQtyProduced: true, totalRejectQty: true, totalScrapQty: true }
    });
    const trueProducedQty = Number(completedHpAgg._sum.totalQtyProduced || 0);
    const trueRejectQty = Number(completedHpAgg._sum.totalRejectQty || 0);
    const trueScrapQty = Number(completedHpAgg._sum.totalScrapQty || 0);
    const trueGoodQty = Math.max(0, trueProducedQty - trueRejectQty);
    const targetQty = Number(order.targetQty || 0);

    let updatedStatus = order.status;
    if (targetQty > 0 && trueGoodQty >= targetQty) {
      if (!["READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED", "COMPLETED"].includes(updatedStatus)) {
        updatedStatus = "COMPLETED";
      }
    }

    // Do not overwrite producedQty for orders already past the production phase —
    // those quantities were set deliberately by daily-plan / post-production completion.
    const isDownstreamStatus = ["READY_FOR_DISPATCH", "DISPATCHED", "FG_RECEIVED"].includes(order.status);

    if (!isDownstreamStatus && (Number(order.producedQty || 0) !== trueGoodQty || order.status !== updatedStatus)) {
      await prisma.productionOrder.update({
        where: { productionOrderId },
        data: {
          producedQty: trueGoodQty,
          rejectedQty: trueRejectQty,
          scrapQty: trueScrapQty,
          status: updatedStatus,
        }
      }).catch(() => {});
      order.producedQty = trueGoodQty;
      order.rejectedQty = trueRejectQty;
      order.scrapQty = trueScrapQty;
      order.status = updatedStatus;

      if (updatedStatus === "COMPLETED") {
        await prisma.weeklyMachineProgram.updateMany({
          where: { productionOrderId },
          data: { status: "COMPLETED" }
        }).catch(() => {});
      }
    }

    const activeRawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
    const rmMap = new Map(activeRawMaterials.map((rm) => [rm.rawMaterialId, rm]));

    const productId = order.productItemId;
    const quantity = Number(order.targetQty);
    let bomItems: any[] = [];
    try {
      bomItems = await (prisma as any).billOfMaterial.findMany({
        where: { productId },
        include: { rawMaterial: true },
      });
    } catch (e) {
      bomItems = [];
    }

    let requiredRms: any[] = [];
    if (bomItems && bomItems.length > 0) {
      requiredRms = bomItems.map((bi: any) => {
        const currentRm = rmMap.get(bi.rawMaterialId) || bi.rawMaterial;
        const requiredQty = Number(bi.requiredQuantity) * quantity;
        const availableStock = currentRm ? Number(currentRm.onHandQty) : 0;
        return {
          rawMaterialId: bi.rawMaterialId,
          materialName: currentRm?.materialName || bi.rawMaterial?.materialName || bi.rawMaterialId,
          requiredQty,
          availableStock,
          status: availableStock >= requiredQty ? "AVAILABLE" : "INSUFFICIENT",
        };
      });
    }

    const products = [
      {
        productId: productId.toString(),
        productCode: order.productItem?.productCode,
        productName: order.productItem?.productName,
        quantity,
        uom: order.uom,
        weightPerPieceUsed: order.weightPerPieceUsed != null ? Number(order.weightPerPieceUsed) : Number(order.productItem?.weightPerPiece || 0),
        rawMaterials:
          order.draftRawMaterials && Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0
            ? (order.draftRawMaterials as any[])
            : requiredRms,
      },
    ];

    const restrictions = await this.computeEditRestrictions(productionOrderId);

    // Resolve user names for audit info
    let createdUserName = "Unknown User";
    let createdUserRole = "Unknown Role";
    if (order.createdBy) {
      if (order.createdBy.startsWith("admin_")) {
        const adminId = BigInt(order.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { username: true, role: { select: { name: true } } } });
        if (admin) {
          createdUserName = admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: order.createdBy }, select: { username: true, role: { select: { name: true } } } });
        if (user) {
          createdUserName = user.username;
          createdUserRole = user.role?.name || "User";
        }
      }
    }

    let updatedUserName = "Unknown User";
    if (order.updatedBy) {
      if (order.updatedBy.startsWith("admin_")) {
        const adminId = BigInt(order.updatedBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { username: true } });
        if (admin) {
          updatedUserName = admin.username;
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: order.updatedBy }, select: { username: true } });
        if (user) {
          updatedUserName = user.username;
        }
      }
    }

    let enrichedEditHistory: any[] = [];
    if (Array.isArray(order.productionOrderHistories)) {
      enrichedEditHistory = await Promise.all(
        order.productionOrderHistories.map(async (hist: any) => {
          let name = "Unknown User";
          if (hist.changedBy) {
            if (hist.changedBy.startsWith("admin_")) {
              const adminId = BigInt(hist.changedBy.replace("admin_", ""));
              const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { username: true } });
              if (admin) name = admin.username;
            } else {
              const user = await prisma.user.findUnique({ where: { userId: hist.changedBy }, select: { username: true } });
              if (user) name = user.username;
            }
          }
          return {
            ...hist,
            id: hist.id ? hist.id.toString() : undefined,
            updatedBy: hist.changedBy,
            updatedByName: name,
            updatedAt: hist.changedAt,
            action: hist.action,
            remarks: hist.remarks,
          };
        })
      );
    }

    // Ensure there is at least a creation record in editHistory
    if (enrichedEditHistory.length === 0 && order.createdAt) {
      enrichedEditHistory.push({
        updatedBy: order.createdBy,
        updatedByName: createdUserName,
        updatedAt: order.createdAt,
        action: "ORDER_CREATED",
        remarks: "Production Order created",
      });
    }

    // If order was updated and no history recorded the update yet, ensure last update is in history
    if (
      order.updatedBy &&
      enrichedEditHistory.length === 1 &&
      order.updatedAt &&
      new Date(order.updatedAt).getTime() > new Date(order.createdAt).getTime() + 1000
    ) {
      enrichedEditHistory.push({
        updatedBy: order.updatedBy,
        updatedByName: updatedUserName,
        updatedAt: order.updatedAt,
        action: "ORDER_UPDATE",
        remarks: "Order updated",
      });
    }

    return {
      ...order,
      weeklyMachinePrograms: Array.isArray(order.weeklyMachinePrograms)
        ? order.weeklyMachinePrograms.map((w: any) => ({
            ...w,
            shift: {
              shiftCode: w.shiftId,
              shiftName: w.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
            },
          }))
        : [],
      productItemId: order.productItemId.toString(),
      products,
      createdUserName,
      createdUserRole,
      updatedUserName,
      editHistory: enrichedEditHistory,
      statusHistory: enrichedEditHistory,
      _editRestrictions: {
        canEditDates: restrictions.canEditDates,
        canEditProductQty: restrictions.canEditProductQty,
        canDelete: restrictions.canDelete,
        reason: restrictions.reason,
      },
    };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(productionOrderId: string, data: UpdateProductionOrderInput, userId?: string) {
    const existing = await this.findById(productionOrderId);

    // ── Guard 1: Date Lock — if any non-finished daily plan exists, dates cannot be modified ──
    const restrictions = await this.computeEditRestrictions(productionOrderId);
    const isChangingDates =
      data.orderDate !== undefined ||
      data.dueDate !== undefined ||
      (data as any).weekStartDate !== undefined ||
      (data as any).weekEndDate !== undefined;
    if (isChangingDates && !restrictions.canEditDates) {
      throw new ApiError(400, "Cannot modify dates: Order is assigned to Daily Production Plan");
    }

    // ── Guard 2: Product + Qty Lock — if active daily plan exists, product/qty cannot be modified ──
    const isChangingProductQty = data.productItemId !== undefined || data.targetQty !== undefined;
    if (isChangingProductQty && !restrictions.canEditProductQty) {
      throw new ApiError(400, "Cannot modify product or quantity: Daily production is in progress");
    }

    // ── Guard 3: Target Qty Lock — if raw material has already been issued, targetQty cannot change ──
    if (data.targetQty !== undefined && Number(data.targetQty) !== Number(existing.targetQty ?? 0)) {
      const materialIssued = await prisma.stockAdjustment.findFirst({
        where: {
          productionOrderId,
          adjustmentType: { in: ["PRODUCTION_MATERIAL_ISSUE", "RAW_MATERIAL_ISSUE"] },
          status: { not: "REJECTED" },
          autoGenerated: true,
        },
        select: { id: true, adjustmentNumber: true },
      });
      if (materialIssued) {
        throw new ApiError(
          400,
          `Cannot change Target Quantity: Raw materials have already been issued for this order (Ref: ${materialIssued.adjustmentNumber}). The issued quantities were calculated based on the original target. Please cancel and create a new order if a quantity change is required.`
        );
      }
    }

    // Locked statuses — only allow status-only updates
    const lockedStatuses = [
      "IN_PRODUCTION",
      "POST_PRODUCTION",
      "PARTIAL_COMPLETED",
      "COMPLETED_WITH_SHORTFALL",
      "READY_FOR_DISPATCH",
      "DISPATCHED",
      "COMPLETED",
      "CLOSED",
      "CANCELLED",
    ];
    if (lockedStatuses.includes(existing.status || "")) {
      const keys = Object.keys(data).filter((k) => (data as any)[k] !== undefined);
      const allowedExecutionKeys = ["status", "producedQty", "rejectedQty", "scrapQty", "remarks"];
      const isSystemStatusUpdate = keys.every((k) => allowedExecutionKeys.includes(k));
      if (!isSystemStatusUpdate) {
        throw new ApiError(400, "Production Order is locked for editing once production has started.");
      }
    }

    const updateData: any = {};
    const editableStatuses = [
      "DRAFT",
      "CREATED",
      "WAITING_FOR_MATERIAL",
      "READY_FOR_PLANNING",
      "PENDING_PLANNING",
      "WEEKLY_SCHEDULED",
      "DAILY_PLANNED",
      "PLANNED",
      "SCHEDULED",
    ];

    if (!lockedStatuses.includes(existing.status || "") || editableStatuses.includes(existing.status || "")) {
      if (data.orderDate !== undefined) updateData.orderDate = new Date(data.orderDate);
      if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
      if (data.weekStartDate !== undefined) updateData.weekStartDate = data.weekStartDate ? new Date(data.weekStartDate) : null;
      if (data.weekEndDate !== undefined) updateData.weekEndDate = data.weekEndDate ? new Date(data.weekEndDate) : null;
      if (data.machineMachineId !== undefined) updateData.machineMachineId = data.machineMachineId;
      if (data.routingId !== undefined) updateData.routingId = data.routingId;

      if (data.productItemId !== undefined) {
        const productItemId = BigInt(data.productItemId);
        const product = await prisma.product.findUnique({ where: { id: productItemId } });
        if (!product) throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
        updateData.productItemId = productItemId;
      }

      if (data.targetQty !== undefined) updateData.targetQty = data.targetQty;
      if (data.uom !== undefined) updateData.uom = data.uom;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.orderType !== undefined) updateData.orderType = data.orderType;
      if (data.batchNo !== undefined) updateData.batchNo = data.batchNo;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;

      if (data.sourceStoreId !== undefined) {
        if (data.sourceStoreId) {
          const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
          if (!store) throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
        }
        updateData.sourceStoreId = data.sourceStoreId;
      }

      if (data.rawMaterials) updateData.draftRawMaterials = data.rawMaterials as any;

      // Recalculate weight/material qty if product or target changed
      const finalProductItemId = updateData.productItemId ?? existing.productItemId;
      const finalTargetQty = updateData.targetQty !== undefined ? Number(updateData.targetQty) : Number(existing.targetQty);
      const product = await prisma.product.findUnique({ where: { id: finalProductItemId } });
      if (product) {
        updateData.weightPerPieceUsed = product.weightPerPiece ? Number(product.weightPerPiece) : 0;
        updateData.requiredRawMaterialQty = finalTargetQty * updateData.weightPerPieceUsed;
      }
    } else {
      // Post-start only allow qty updates
      if (data.producedQty !== undefined) updateData.producedQty = data.producedQty;
      if (data.rejectedQty !== undefined) updateData.rejectedQty = data.rejectedQty;
      if (data.scrapQty !== undefined) updateData.scrapQty = data.scrapQty;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;
    }

    // Status transition logic
    let calculatedStatus = data.status ?? existing.status;
    if (data.status && data.status !== existing.status) {
      this.validateStatusTransition(existing.status || "CREATED", data.status);
      calculatedStatus = data.status;
    }

    updateData.status = calculatedStatus;
    updateData.updatedBy = userId;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const resultOrder = await tx.productionOrder.update({
        where: { productionOrderId },
        data: updateData,
        include: { productItem: true },
      });

      // Update linked weekly machine programs if week dates or machine changed
      if (updateData.weekStartDate !== undefined || updateData.weekEndDate !== undefined || updateData.machineMachineId !== undefined) {
        const wpUpdateData: any = {};
        if (updateData.weekStartDate !== undefined) wpUpdateData.weekStartDate = updateData.weekStartDate;
        if (updateData.weekEndDate !== undefined) wpUpdateData.weekEndDate = updateData.weekEndDate;
        if (updateData.machineMachineId !== undefined) wpUpdateData.machineId = updateData.machineMachineId;
        if (Object.keys(wpUpdateData).length > 0) {
          await tx.weeklyMachineProgram.updateMany({
            where: { productionOrderId },
            data: wpUpdateData,
          });
        }
      }

      // Log status change or update in history
      if (calculatedStatus !== existing.status) {
        await this.addHistory(
          tx,
          productionOrderId,
          existing.status,
          calculatedStatus,
          userId,
          data.remarks || `Status changed to ${calculatedStatus}`,
          "STATUS_CHANGE"
        );
      } else {
        await this.addHistory(
          tx,
          productionOrderId,
          existing.status,
          calculatedStatus,
          userId,
          data.remarks || "Order updated",
          "ORDER_UPDATE"
        );
      }

      return resultOrder;
    }, { timeout: 15000, maxWait: 10000 });

    return updatedOrder;
  }

  // ── Start Production ──────────────────────────────────────────────────────
  // STEP 5: Production Start
  // - Status must be DAILY_PLANNED / IN_PRODUCTION (for subsequent shifts)
  // - Auto-create RAW_MATERIAL_ISSUE stock adjustment per shift (based on shift plannedQty)
  // - Deduct raw material stock proportional to shift's plannedQty / PO targetQty
  // - Insert raw material transactions
  // - Set status to IN_PRODUCTION
  async startProduction(productionOrderId: string, userId?: string, dailyPlanId?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
    }) as any;

    if (!order) {
      throw new ApiError(404, `Production Order ${productionOrderId} not found`);
    }

    const allowedStartStatuses = ["DAILY_PLANNED", "PARTIAL_COMPLETED", "IN_PRODUCTION", "IN_PROGRESS", "POST_PRODUCTION", "WEEKLY_SCHEDULED", "DISPATCHED"];
    if (!allowedStartStatuses.includes(order.status)) {
      throw new ApiError(
        400,
        `Production can only be started for active orders. Current status: ${order.status}`
      );
    }

    // ── Resolve planned quantity for this specific shift ──────────────────────
    let shiftPlannedQty: number | null = null;
    const poTargetQty = Number(order.targetQty || 0);

    if (dailyPlanId) {
      const dailyPlan = await prisma.dailyProductionPlan.findUnique({
        where: { dailyPlanId },
        select: { plannedQty: true },
      });
      if (dailyPlan) {
        shiftPlannedQty = Number(dailyPlan.plannedQty || 0);
        // Idempotency: check if this specific daily plan already had materials issued
        const existingIssueForShift = await prisma.stockAdjustment.findFirst({
          where: { productionOrderId, adjustmentType: "RAW_MATERIAL_ISSUE", status: { not: "REJECTED" }, sourceDocId: dailyPlanId },
        });
        if (existingIssueForShift) {
          const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.productionOrder.update({ where: { productionOrderId }, data: { status: "IN_PRODUCTION", updatedBy: userId } });
            await this.addHistory(tx, productionOrderId, order.status, "IN_PRODUCTION", userId,
              `Production started for shift plan ${dailyPlanId} (materials already issued for this shift)`, "PRODUCTION_START");
            return result;
          }, { timeout: 15000, maxWait: 10000 });
          return updated;
        }
      }
    } else {
      // Legacy path: global idempotency check (no dailyPlanId provided)
      const existingIssue = await prisma.stockAdjustment.findFirst({
        where: { productionOrderId, adjustmentType: "RAW_MATERIAL_ISSUE", status: { not: "REJECTED" }, sourceDocId: null },
      });
      if (existingIssue) {
        const updated = await prisma.$transaction(async (tx) => {
          const result = await tx.productionOrder.update({ where: { productionOrderId }, data: { status: "IN_PRODUCTION", updatedBy: userId } });
          await this.addHistory(tx, productionOrderId, order.status, "IN_PRODUCTION", userId,
            "Production started (materials already issued)", "PRODUCTION_START");
          return result;
        }, { timeout: 15000, maxWait: 10000 });
        return updated;
      }
    }

    // Proportional ratio: e.g. shift=500, target=4000 → 0.125
    const qtyRatio = (shiftPlannedQty !== null && poTargetQty > 0) ? shiftPlannedQty / poTargetQty : 1;

    const rawMaterials: any[] = Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0
      ? order.draftRawMaterials as any[]
      : [];

    if (rawMaterials.length === 0) {
      // Check if there is a BOM for this product (but not in draftRawMaterials)
      const bomCount = await prisma.billOfMaterial.count({ where: { productId: order.productItemId ? BigInt(order.productItemId) : undefined } });
      const noBomWarning = bomCount === 0;

      return await prisma.$transaction(async (tx) => {
        const result = await tx.productionOrder.update({
          where: { productionOrderId },
          data: { status: "IN_PRODUCTION", updatedBy: userId },
        });
        const remarks = noBomWarning
          ? "Production started — WARNING: No Bill of Materials found. Raw material consumption is NOT being tracked for this order."
          : "Production started (no raw materials configured)";
        await this.addHistory(tx, productionOrderId, order.status, "IN_PRODUCTION", userId, remarks,
          noBomWarning ? "NO_BOM_WARNING" : "PRODUCTION_START");
        return { ...result, bomWarning: noBomWarning ? remarks : null };
      }, { timeout: 15000, maxWait: 10000 });
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const planSuffix = dailyPlanId ? `-${dailyPlanId}` : "";
      const adjustmentNumber = `RMI-${productionOrderId}${planSuffix}-${dateStr}`;

      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: now,
          adjustmentType: "RAW_MATERIAL_ISSUE",
          productionOrderId,
          reason: dailyPlanId
            ? `Raw material issued for Production Order: ${productionOrderId}, Daily Plan: ${dailyPlanId} (Shift Start)`
            : `Raw material issued for Production Order: ${productionOrderId} (Production Start)`,
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: now,
          createdBy: userId,
          autoGenerated: true,
          sourceDocument: dailyPlanId ? "DAILY_PLAN" : "PRODUCTION_ORDER",
          sourceDocId: dailyPlanId ?? productionOrderId,
        },
      });

      // 2. Process each raw material — scale qty to this shift's proportion
      for (const rm of rawMaterials) {
        const { rawMaterialId, requiredQty } = rm;
        const fullQty = Number(requiredQty);
        const qty = parseFloat((fullQty * qtyRatio).toFixed(6));
        if (!rawMaterialId || qty <= 0) continue;

        const stock = await tx.rawMaterial.findUnique({
          where: { rawMaterialId },
          include: { store: true },
        });

        if (!stock) continue;

        // Check for negative stock (unless store allows)
        const newOnHand = Number(stock.onHandQty) - qty;
        const allowNegative = stock.store?.allowNegative ?? false;
        if (newOnHand < 0 && !allowNegative) {
          throw new ApiError(
            400,
            `Insufficient stock for raw material "${stock.materialName}" (${rawMaterialId}). Available: ${Number(stock.onHandQty).toFixed(3)}, Required for this shift (${shiftPlannedQty ?? fullQty} pcs): ${qty.toFixed(3)}`
          );
        }

        const storeId = stock.storeId || order.sourceStoreId;
        if (!storeId) continue;

        const currentQty = stock.onHandQty;
        const newReserved = Math.max(0, Number(stock.reservedQty) - qty);

        // 3. Deduct raw material stock
        await tx.rawMaterial.update({
          where: { rawMaterialId },
          data: {
            onHandQty: newOnHand,
            reservedQty: newReserved,
            updatedBy: userId,
          },
        });

        // 4. Create stock adjustment item
        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: stockAdjustment.id,
            itemType: "RAW_MATERIAL",
            rawMaterialId,
            storeId,
            currentQty,
            adjustedQty: newOnHand,
            difference: -qty,
            remarks: dailyPlanId
              ? `Issued for Daily Plan ${dailyPlanId} (${shiftPlannedQty} pcs of PO ${productionOrderId} target ${poTargetQty} pcs)`
              : `Issued for Production Order ${productionOrderId} on production start`,
          },
        });

        // 5. Insert raw material transaction
        await tx.rawMaterialTransaction.create({
          data: {
            storeId,
            rawMaterialId,
            txnType: "RAW_MATERIAL_ISSUE",
            qty: -qty,
            productionOrderId,
            remarks: dailyPlanId
              ? `Issued for Daily Plan ${dailyPlanId} (${shiftPlannedQty} pcs of PO ${productionOrderId})`
              : `Issued for Production Order ${productionOrderId} on production start`,
          },
        });
      }

      // 6. Update production order status to IN_PRODUCTION
      const result = await tx.productionOrder.update({
        where: { productionOrderId },
        data: { status: "IN_PRODUCTION", updatedBy: userId },
        include: { productItem: true },
      });

      // 7. Log history
      await this.addHistory(
        tx,
        productionOrderId,
        order.status,
        "IN_PRODUCTION",
        userId,
        dailyPlanId
          ? `Production started for Daily Plan ${dailyPlanId} (${shiftPlannedQty} pcs). Raw materials issued proportionally (ratio: ${qtyRatio.toFixed(4)}).`
          : "Production started. Raw materials issued.",
        "PRODUCTION_START",
        { stockAdjustmentId: stockAdjustment.id.toString(), rawMaterialsIssued: rawMaterials.length, dailyPlanId: dailyPlanId ?? null, shiftPlannedQty: shiftPlannedQty ?? null, qtyRatio }
      );

      return result;
    }, { timeout: 15000, maxWait: 10000 });
  }

  // ── Complete Post-Production Step → READY_FOR_DISPATCH ───────────────────
  // STEP 7 → STEP 8 gate: Only after all post-production steps done
  async completePostProduction(productionOrderId: string, producedQty: number, userId?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
    });

    if (!order) throw new ApiError(404, `Production Order ${productionOrderId} not found`);

    if (order.status !== "POST_PRODUCTION") {
      throw new ApiError(
        400,
        `Production Order must be in POST_PRODUCTION status to complete. Current: ${order.status}`
      );
    }

    return prisma.$transaction(async (tx) => {
      const result = await tx.productionOrder.update({
        where: { productionOrderId },
        data: {
          status: "READY_FOR_DISPATCH",
          producedQty,
          updatedBy: userId,
        },
      });

      await this.addHistory(
        tx,
        productionOrderId,
        "POST_PRODUCTION",
        "READY_FOR_DISPATCH",
        userId,
        `Post-production completed. Produced qty: ${producedQty}. Order is ready for dispatch.`,
        "POST_PRODUCTION_COMPLETE"
      );

      return result;
    }, { timeout: 15000, maxWait: 10000 });
  }

  // ── Manual Material Issue (legacy/partial) ────────────────────────────────
  // Kept for cases where partial material issue is needed separately.
  // Now gated: only READY_FOR_PLANNING or WEEKLY_SCHEDULED orders.
  async issueMaterials(
    productionOrderId: string,
    data: { items: { rawMaterialId: string; storeId: string; qty: number; selectedUom?: string; remarks?: string }[] },
    userId?: string
  ) {
    const { items } = data;

    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
    });
    if (!order) throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);

    // Status gate
    const allowedForManualIssue = [
      "READY_FOR_PLANNING",
      "WEEKLY_SCHEDULED",
      "DAILY_PLANNED",
      "IN_PROGRESS",
      "PARTIAL_COMPLETED",
      "POST_PRODUCTION",
      "READY_FOR_DISPATCH",
      "DISPATCHED", // Allow if accidentally fully dispatched but target not met
    ];
    if (!allowedForManualIssue.includes(order.status)) {
      throw new ApiError(
        400,
        `Cannot issue materials for a Production Order with status "${order.status}". Allowed statuses: ${allowedForManualIssue.join(", ")}`
      );
    }

    // Duplicate guard: prevent issuing materials if all requested materials have already been fully issued for this PO
    const existingIssues = await prisma.stockAdjustment.findMany({
      where: {
        productionOrderId,
        adjustmentType: { in: ["RAW_MATERIAL_ISSUE", "PRODUCTION_MATERIAL_ISSUE"] },
        status: { not: "REJECTED" },
      },
      include: { items: true }
    });

    if (existingIssues.length > 0) {
      // Calculate total issued quantity per raw material for this PO
      const issuedQtyMap = new Map<string, number>();
      for (const adj of existingIssues) {
        for (const adjItem of adj.items) {
          if (adjItem.rawMaterialId) {
            const current = issuedQtyMap.get(adjItem.rawMaterialId) || 0;
            issuedQtyMap.set(adjItem.rawMaterialId, current + Math.abs(Number(adjItem.difference || 0)));
          }
        }
      }

      // Check if all items being requested have already been issued up to the total required
      let allItemsFullyIssued = items.length > 0;
      for (const item of items) {
        const alreadyIssued = issuedQtyMap.get(item.rawMaterialId) || 0;
        // If already issued + current issue exceeds or equals requirement, check if already issued alone met it
        // We block only if already issued alone already satisfied the full PO requirement for every item
        if (alreadyIssued === 0) {
          allItemsFullyIssued = false;
          break;
        }
      }

      // Only block if an issue was already done for the full PO requirement
      const firstIssue = existingIssues[0];
      const poTarget = Number(order.targetQty || 0);
      // If there's an existing issue that covered the full PO target, block duplicate
      const fullTargetAlreadyIssued = existingIssues.some((adj: any) => {
        // If single issue had full target or total issued equals full target requirement
        return adj.remarks?.includes("Full PO") || false;
      });

      if (fullTargetAlreadyIssued) {
        throw new ApiError(
          400,
          `Materials have already been fully issued for Production Order ${productionOrderId} (${firstIssue.adjustmentNumber}). Duplicate issue is not allowed.`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const adjustmentNumber = `RMI-${productionOrderId}-${dateStr}`;

      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: now,
          adjustmentType: "RAW_MATERIAL_ISSUE",
          productionOrderId,
          reason: `Manual material issued for Production Order: ${productionOrderId}`,
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: now,
          createdBy: userId,
        },
      });

      for (const item of items) {
        const { rawMaterialId, storeId, qty, selectedUom, remarks } = item;

        const rm = await tx.rawMaterial.findUnique({ where: { rawMaterialId } });
        if (!rm) throw new ApiError(404, `Raw Material with ID ${rawMaterialId} not found`);

        // Convert qty from the user's selected UOM to the raw material's base UOM.
        const rmBaseUom = String(rm.baseUom || "kg");
        const issueUom = selectedUom || rmBaseUom;
        const convertedQty = convertToBaseUom(qty, issueUom, rmBaseUom);

        const currentQty = rm.onHandQty;
        const newOnHand = Number(rm.onHandQty) - convertedQty;
        const newReserved = Math.max(0, Number(rm.reservedQty) - convertedQty);

        await tx.rawMaterial.update({
          where: { rawMaterialId },
          data: { onHandQty: newOnHand, reservedQty: newReserved, updatedBy: userId },
        });

        await tx.rawMaterialTransaction.create({
          data: {
            storeId,
            rawMaterialId,
            txnType: "RAW_MATERIAL_ISSUE",
            qty: -convertedQty,
            remarks: remarks || `Issued for Production Order ${productionOrderId}`,
            productionOrderId,
          },
        });

        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: stockAdjustment.id,
            itemType: "RAW_MATERIAL",
            rawMaterialId,
            storeId,
            currentQty,
            adjustedQty: newOnHand,
            difference: -convertedQty,
            remarks: remarks || `Issued for Production Order ${productionOrderId}`,
          },
        });
      }

      await this.addHistory(
        tx,
        productionOrderId,
        order.status,
        order.status,
        userId,
        `Manual material issue created: ${adjustmentNumber}`,
        "MANUAL_MATERIAL_ISSUE"
      );

      return { adjustmentNumber, stockAdjustmentId: stockAdjustment.id.toString() };
    }, { maxWait: 15000, timeout: 30000 });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete(productionOrderId: string) {
    const existing = await this.findById(productionOrderId);

    // ── Primary Guard: block delete if any non-finished daily plan exists ──
    const finishedStatuses = ["CANCELLED", "SHORT_CLOSED", "STOPPED", "COMPLETED"];
    const activePlanCount = await prisma.dailyProductionPlan.count({
      where: {
        productionOrderId,
        status: { notIn: finishedStatuses },
      },
    });
    if (activePlanCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete: Order has ${activePlanCount} active Daily Production Plan(s). Cancel them in Daily Machine Planning first.`
      );
    }

    const undeletableStatuses = ["IN_PRODUCTION", "POST_PRODUCTION", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "DAILY_PLANNED"];
    if (undeletableStatuses.includes(existing.status)) {
      throw new ApiError(400, `Production Order cannot be deleted with status "${existing.status}".`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Nullify optional FKs that have no cascade
      await tx.rawMaterialTransaction.updateMany({
        where: { productionOrderId },
        data: { productionOrderId: null },
      });
      await tx.stockAdjustment.updateMany({
        where: { productionOrderId },
        data: { productionOrderId: null },
      });

      // 2. Nullify HourlyProduction.dailyPlanId before daily plans are deleted
      const dailyPlanIds = (await tx.dailyProductionPlan.findMany({
        where: { productionOrderId },
        select: { dailyPlanId: true },
      })).map((p) => p.dailyPlanId);

      if (dailyPlanIds.length > 0) {
        await tx.hourlyProduction.updateMany({
          where: { dailyPlanId: { in: dailyPlanIds } },
          data: { dailyPlanId: null },
        });
      }

      // 3. Delete WeeklyMachinePrograms (cascades to DailyProductionPlan)
      await tx.weeklyMachineProgram.deleteMany({ where: { productionOrderId } });

      // 4. Delete remaining DailyProductionPlans not linked to a weekly program
      await tx.dailyProductionPlan.deleteMany({ where: { productionOrderId } });

      // 5. Delete the ProductionOrder (cascades: HourlyProduction, ProductionWastage, ProductionOrderHistory)
      await tx.productionOrder.delete({ where: { productionOrderId } });
    });

    return { message: "Production order deleted successfully" };
  }

  // ── Get next ID ───────────────────────────────────────────────────────────
  async getNextProductionOrderId() {
    const lastItem = await prisma.productionOrder.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!lastItem) return "PRO0001";

    let lastId = lastItem.productionOrderId;
    if (lastId.includes("-")) lastId = lastId.split("-")[0];

    const match = lastId.match(/\d+/);
    if (!match) return lastId + "0001";

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const suffix = lastId.substring(lastId.indexOf(numberStr) + numberStr.length);
    return `PRO${paddedNumber}${suffix}`;
  }

  // ── Get Production Order History ──────────────────────────────────────────
  async getHistory(productionOrderId: string) {
    const history = await prisma.productionOrderHistory.findMany({
      where: { productionOrderId },
      orderBy: { changedAt: "asc" },
    });

    // Separate admin IDs ("admin_<n>") from regular user UUIDs
    const allIds = Array.from(new Set(history.map((h) => h.changedBy).filter(Boolean))) as string[];
    const adminIds = allIds.filter((id) => id.startsWith("admin_"));
    const userIds  = allIds.filter((id) => !id.startsWith("admin_"));

    const nameMap = new Map<string, string>();

    // Resolve regular users
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true, username: true },
      });
      users.forEach((u) => nameMap.set(u.userId, u.fullName || u.username));
    }

    // Resolve admins (stored as "admin_<bigint id>")
    if (adminIds.length > 0) {
      const numericIds = adminIds
        .map((id) => { try { return BigInt(id.replace("admin_", "")); } catch { return null; } })
        .filter((n): n is bigint => n !== null);
      if (numericIds.length > 0) {
        const admins = await prisma.admin.findMany({
          where: { id: { in: numericIds } },
          select: { id: true, fullName: true, username: true },
        });
        admins.forEach((a) => nameMap.set(`admin_${a.id}`, a.fullName || a.username));
      }
    }

    return history.map((h) => ({
      ...h,
      id: h.id.toString(),
      changedByName: h.changedBy ? (nameMap.get(h.changedBy) ?? h.changedBy) : null,
    }));
  }

  // ── Machine Program List ──────────────────────────────────────────────────
  // Returns all production orders for a given machine and week (Mon–Sun)
  // Used by the create form to show the machine program board for the selected week
  async getMachinePrograms(machineId: string, weekStartDate: string) {
    // snapToMonday() on the frontend sends Monday (e.g. 2026-09-07), but production
    // orders may have been created with Sunday as weekStartDate (e.g. 2026-09-06).
    // Extend start back by 1 day so the range [Sun, Sun+7] covers both cases.
    const start = new Date(weekStartDate);
    start.setDate(start.getDate() - 1);
    // Week end = original Monday + 6 days (Saturday)
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // The actual Monday–Saturday calendar week the board is showing (distinct from
    // the padded start/end above, which only exists to match legacy
    // ProductionOrder.weekStartDate values that may have been stored as Sunday).
    const viewedWeekStart = new Date(weekStartDate);
    viewedWeekStart.setHours(0, 0, 0, 0);
    const viewedWeekEnd = new Date(weekStartDate);
    viewedWeekEnd.setDate(viewedWeekEnd.getDate() + 5);
    viewedWeekEnd.setHours(23, 59, 59, 999);

    // A shift whose date has already passed is done, whether or not anyone
    // bothered to flip its status to a terminal one — its real contribution is
    // already captured in producedQty. Only a shift that HASN'T happened yet
    // still counts as "reserved" capacity that shouldn't be re-offered.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Quantity already committed to this order in OTHER weeks that hasn't been
    // produced yet: still-active (non-terminal) daily plans dated today or later.
    // Excluding terminal statuses (COMPLETED/STOPPED/SHORT_CLOSED/CANCELLED) AND
    // requiring productionDate >= today are both applied — belt-and-suspenders —
    // so a shift that under-produced (e.g. power cut) and was simply left in
    // PLANNED/IN_PROGRESS status without ever being formally closed still stops
    // counting once its date passes, instead of masking the real shortfall.
    const getPlannedElsewhereMap = async (rows: any[]) => {
      const orderIds = rows.map((o: any) => o.productionOrderId);
      if (orderIds.length === 0) return new Map<string, number>();
      const grouped = await prisma.dailyProductionPlan.groupBy({
        by: ["productionOrderId"],
        where: {
          productionOrderId: { in: orderIds },
          status: { notIn: ["CANCELLED", "COMPLETED", "STOPPED", "SHORT_CLOSED"] },
          productionDate: { gte: today },
          OR: [
            { productionDate: { lt: viewedWeekStart } },
            { productionDate: { gt: viewedWeekEnd } },
          ],
        },
        _sum: { plannedQty: true },
      });
      const map = new Map<string, number>();
      grouped.forEach((g: any) => map.set(g.productionOrderId, Number(g._sum.plannedQty || 0)));
      return map;
    };

    // Whether this order genuinely has ANY plan dated before the week being
    // viewed — real history, not a guess from ProductionOrder.weekStartDate
    // (which is just a one-time, user-entered field set at order creation and
    // isn't reliable proof of what week the order was actually worked in).
    // This is what "Carried forward" should be based on: did real prior-week
    // activity happen, not "is this order's nominal week tag older."
    const getHadPriorPlanSet = async (rows: any[]) => {
      const orderIds = rows.map((o: any) => o.productionOrderId);
      if (orderIds.length === 0) return new Set<string>();
      const grouped = await prisma.dailyProductionPlan.groupBy({
        by: ["productionOrderId"],
        where: {
          productionOrderId: { in: orderIds },
          status: { not: "CANCELLED" },
          productionDate: { lt: viewedWeekStart },
        },
      });
      return new Set(grouped.map((g: any) => g.productionOrderId));
    };

    const mapOrders = (rows: any[], plannedElsewhereMap: Map<string, number>, hadPriorPlanSet: Set<string>) => rows.map((o: any) => ({
      productionOrderId: o.productionOrderId,
      productName: o.productItem.productName,
      productCode: o.productItem.productCode,
      productItemId: o.productItemId.toString(),
      machineId: o.machineMachineId ?? null,
      noOfPcs: Number(o.targetQty),
      producedQty: Number(o.producedQty ?? 0),
      plannedElsewhere: plannedElsewhereMap.get(o.productionOrderId) || 0,
      hadPriorPlan: hadPriorPlanSet.has(o.productionOrderId),
      // Its own originally-scheduled window (weekStartDate–weekEndDate) has
      // fully elapsed with nothing done — overdue regardless of whether it
      // ever had a plan or shift created. Anchored to real "today", not to
      // whichever week happens to be on screen, so it stays correct whether
      // you're viewing the order's own current week (not overdue) or looking
      // at it weeks later after it sat untouched (overdue).
      isOverdue: Boolean(o.weekEndDate && new Date(o.weekEndDate) < today),
      uom: o.uom,
      weekStartDate: o.weekStartDate ?? null,
      weekEndDate: o.weekEndDate ?? null,
      status: o.status,
      remarks: o.remarks ?? "",
    }));

    try {
      // Include orders originally scheduled on or before this week (so an order
      // whose target wasn't fully planned/produced keeps resurfacing in later
      // weeks instead of being stuck on its first-assigned week forever)
      // OR orders that have no weekStartDate set yet (unscheduled / legacy orders)
      const orders = await (prisma.productionOrder as any).findMany({
        where: {
          machineMachineId: machineId,
          OR: [
            { weekStartDate: { lte: end } },
            { weekStartDate: null },
          ],
          // COMPLETED_WITH_SHORTFALL, STOPPED, SHORT_CLOSED are deliberately excluded alongside CANCELLED/DISPATCHED/DRAFT:
          // unlike an order that's merely behind schedule (which SHOULD keep resurfacing, per the
          // comment above), a shortfall/stopped order was explicitly force-stopped/closed via "Permanent
          // Stop" — its remaining qty must never be schedulable again.
          status: { notIn: ["CANCELLED", "DISPATCHED", "DRAFT", "COMPLETED_WITH_SHORTFALL", "STOPPED", "SHORT_CLOSED"] },
        },
        include: {
          productItem: { select: { productName: true, productCode: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      const [plannedElsewhereMap, hadPriorPlanSet] = await Promise.all([
        getPlannedElsewhereMap(orders),
        getHadPriorPlanSet(orders),
      ]);
      return mapOrders(orders, plannedElsewhereMap, hadPriorPlanSet);
    } catch {
      // Fallback: weekStartDate column may not exist yet (migration pending).
      // Return all plannable orders for the machine without the week filter.
      const orders = await prisma.productionOrder.findMany({
        where: {
          machineMachineId: machineId,
          status: { notIn: ["CANCELLED", "DISPATCHED", "DRAFT", "COMPLETED_WITH_SHORTFALL", "STOPPED", "SHORT_CLOSED"] },
        },
        include: {
          productItem: { select: { productName: true, productCode: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      const [plannedElsewhereMap, hadPriorPlanSet] = await Promise.all([
        getPlannedElsewhereMap(orders),
        getHadPriorPlanSet(orders),
      ]);
      return mapOrders(orders, plannedElsewhereMap, hadPriorPlanSet);
    }
  }
}

export default new ProductionOrderService();
