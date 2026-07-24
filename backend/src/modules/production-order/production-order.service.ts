import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateProductionOrderInput, UpdateProductionOrderInput, ProductionOrderQueryInput } from "./production-order.validation";
import { Prisma } from "@prisma/client";
import { StatusSyncService } from "../../utils/status-sync.util";

// ============================================================
// STATUS TRANSITION RULES (ERP Standard Manufacturing Flow)
// CREATED → READY_FOR_PLANNING ↔ WAITING_FOR_MATERIAL
//         → WEEKLY_SCHEDULED → DAILY_PLANNED
//         → IN_PRODUCTION → POST_PRODUCTION
//         → READY_FOR_DISPATCH → DISPATCHED
// ============================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["WAITING_FOR_MATERIAL", "READY_FOR_PLANNING", "CANCELLED"],
  WAITING_FOR_MATERIAL: ["READY_FOR_PLANNING", "CANCELLED"],
  READY_FOR_PLANNING: ["WAITING_FOR_MATERIAL", "WEEKLY_SCHEDULED", "CANCELLED"],
  WEEKLY_SCHEDULED: ["READY_FOR_PLANNING", "DAILY_PLANNED", "CANCELLED"],
  DAILY_PLANNED: ["WEEKLY_SCHEDULED", "IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["POST_PRODUCTION", "CANCELLED"],
  POST_PRODUCTION: ["READY_FOR_DISPATCH", "PARTIAL_COMPLETED"],
  PARTIAL_COMPLETED: ["READY_FOR_DISPATCH", "DISPATCHED"],
  READY_FOR_DISPATCH: ["DISPATCHED"],
  DISPATCHED: [],
  CANCELLED: [],
  // Legacy aliases (tolerated for backward compat)
  PLANNED: ["READY_FOR_PLANNING", "WEEKLY_SCHEDULED", "CANCELLED"],
  SCHEDULED: ["WEEKLY_SCHEDULED", "DAILY_PLANNED", "CANCELLED"],
  COMPLETED: ["READY_FOR_DISPATCH", "DISPATCHED"],
};

class ProductionOrderService {

  // ── Helpers ──────────────────────────────────────────────────────────────

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
    const sourceSalesOrderLineId = data.sourceSalesOrderLineId ? BigInt(data.sourceSalesOrderLineId) : null;

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

    if (data.sourceSalesOrderId) {
      let salesOrder = null;
      if (!isNaN(Number(data.sourceSalesOrderId))) {
        salesOrder = await prisma.salesOrder.findUnique({ where: { id: Number(data.sourceSalesOrderId) } });
      }
      if (!salesOrder) {
        salesOrder = await prisma.salesOrder.findUnique({ where: { orderNo: data.sourceSalesOrderId } });
      }
      if (!salesOrder) {
        throw new ApiError(404, `Sales Order with ID/No ${data.sourceSalesOrderId} not found`);
      }

      const existingPoForSo = await prisma.productionOrder.findFirst({
        where: {
          sourceSalesOrderId: data.sourceSalesOrderId,
          ...(sourceSalesOrderLineId ? { sourceSalesOrderLineId } : {}),
          NOT: { status: "CANCELLED" },
        },
      });
      if (existingPoForSo) {
        throw new ApiError(400, "A Production Order has already been created for this item in the Sales Order.");
      }
    }

    if (data.sourceStoreId) {
      const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
      if (!store) throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
    }

    if (data.destinationStoreId) {
      const store = await prisma.store.findUnique({ where: { storeId: data.destinationStoreId } });
      if (!store) throw new ApiError(404, `Destination Store with ID ${data.destinationStoreId} not found`);
    }

    if (data.machineMachineId) {
      const machine = await prisma.machine.findUnique({ where: { machineId: data.machineMachineId } });
      if (!machine) throw new ApiError(404, `Machine with ID ${data.machineMachineId} not found`);
    }

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
          lotNo: data.lotNo,
          sourceSalesOrderId: data.sourceSalesOrderId,
          sourceSalesOrderLineId,
          sourceStoreId: data.sourceStoreId,
          destinationStoreId: data.destinationStoreId,
          billOfMaterialId: data.billOfMaterialId ? String(data.billOfMaterialId) : null,
          routingId: data.routingId,
          machineMachineId: data.machineMachineId,
          status: data.status === "DRAFT" ? "DRAFT" : "CREATED",
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
        data.status === "DRAFT" ? "DRAFT" : "CREATED",
        userId,
        data.remarks ?? "Production order created",
        "CREATE"
      );

      // Update linked Sales Order productionStatus
      if (data.sourceSalesOrderId) {
        await StatusSyncService.syncSalesOrderProductionStatus(tx, data.sourceSalesOrderId);
      }

      return createdOrder;
    });

    // STEP 2: Auto-check raw material availability immediately after creation
    try {
      if (result.status !== "DRAFT") {
        await this.checkMaterialAvailability(result.productionOrderId, userId);
      }
      // Return the updated order with the new status
      const updatedOrder = await prisma.productionOrder.findUnique({
        where: { productionOrderId: result.productionOrderId },
        include: { productItem: true },
      });
      return updatedOrder || result;
    } catch (error) {
      console.error("Auto material check failed after PO creation:", error);
      return result;
    }
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
    });

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
      sourceSalesOrderId,
    } = query;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.ProductionOrderWhereInput = {};

    if (productItemId) where.productItemId = BigInt(productItemId);
    if (productionOrderId) where.productionOrderId = { contains: productionOrderId, mode: "insensitive" };
    if (sourceSalesOrderId) where.sourceSalesOrderId = sourceSalesOrderId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { productionOrderId: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
        { sourceSalesOrderId: { contains: search, mode: "insensitive" } },
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

    const soIdsOrNos = Array.from(new Set(items.map((i) => i.sourceSalesOrderId).filter(Boolean))) as string[];
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        OR: [
          { id: { in: soIdsOrNos.map((id) => Number(id)).filter((id) => !isNaN(id)) } },
          { orderNo: { in: soIdsOrNos } },
        ],
      },
      include: { customer: true, items: true },
    });

    const salesOrderMap = new Map(
      salesOrders.flatMap((so) => [
        [so.id.toString(), so],
        [so.orderNo, so],
      ])
    );

    const formattedItems = items.map((item) => {
      const so = item.sourceSalesOrderId ? salesOrderMap.get(item.sourceSalesOrderId) : null;
      const totalProducts = so ? so.items.length : 1;
      const totalProductionQuantity = so
        ? so.items.reduce((sum, i) => sum + Number(i.quantity), 0)
        : Number(item.targetQty);
      return {
        ...item,
        productItemId: item.productItemId.toString(),
        sourceSalesOrderLineId: item.sourceSalesOrderLineId?.toString(),
        totalProducts,
        totalProductionQuantity,
        salesOrderDetails: so
          ? {
              orderNo: so.orderNo,
              customerName: so.customer?.firmName || so.customer?.displayName || "Unknown",
            }
          : null,
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
            shift: true,
            machine: true,
            hourlyProductions: true,
          },
          orderBy: [{ productionDate: "asc" }],
        },
        weeklyMachinePrograms: {
          include: {
            shift: true,
            machine: true,
            dailyProductionPlans: {
              include: { shift: true, machine: true, hourlyProductions: true },
            },
          },
        },
        goodsDispatchItems: { include: { dispatch: true } },
        productionOrderHistories: {
          orderBy: { changedAt: "asc" },
        },
      },
    })) as any;

    if (!order) {
      throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);
    }

    const activeRawMaterials = await prisma.rawMaterial.findMany({ where: { isActive: true } });
    const rmMap = new Map(activeRawMaterials.map((rm) => [rm.rawMaterialId, rm]));

    let products: any[] = [];

    if (order.sourceSalesOrderId) {
      let salesOrder = null;
      if (!isNaN(Number(order.sourceSalesOrderId))) {
        salesOrder = await prisma.salesOrder.findUnique({
          where: { id: Number(order.sourceSalesOrderId) },
          include: { items: { include: { product: { include: { uom: true } } } }, customer: true },
        });
      }
      if (!salesOrder) {
        salesOrder = await prisma.salesOrder.findUnique({
          where: { orderNo: order.sourceSalesOrderId },
          include: { items: { include: { product: { include: { uom: true } } } }, customer: true },
        });
      }

      if (salesOrder) {
        products = await Promise.all(
          salesOrder.items.map(async (item: any) => {
            const productId = item.productId;
            const quantity = Number(item.quantity);
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

            const isSelectedLine = productId.toString() === order.productItemId.toString();
            const weightUsed = isSelectedLine && order.weightPerPieceUsed != null
              ? Number(order.weightPerPieceUsed)
              : Number(item.product?.weightPerPiece || 0);

            let finalRms: any[] = [];
            if (order.draftRawMaterials && Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0) {
              finalRms = (order.draftRawMaterials as any[]).map((rm: any) => {
                const currentRm = rmMap.get(rm.rawMaterialId);
                const availableStock = currentRm ? Number(currentRm.onHandQty) : 0;
                const reqQty = Number(rm.requiredQty);
                return {
                  ...rm,
                  materialName: currentRm?.materialName || rm.rawMaterialId,
                  availableStock,
                  status: availableStock >= reqQty ? "AVAILABLE" : "INSUFFICIENT",
                };
              });
            } else {
              finalRms = requiredRms;
            }

            return {
              productId: productId.toString(),
              productCode: item.product?.productCode,
              productName: item.product?.productName,
              quantity,
              uom: item.product?.uom?.uomCode || "PCS",
              weightPerPieceUsed: weightUsed,
              rawMaterials: finalRms,
            };
          })
        );
      }
    }

    if (products.length === 0) {
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

      products = [
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
    }

    return {
      ...order,
      productItemId: order.productItemId.toString(),
      sourceSalesOrderLineId: order.sourceSalesOrderLineId?.toString(),
      products,
      statusHistory: order.productionOrderHistories || [],
    };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(productionOrderId: string, data: UpdateProductionOrderInput, userId?: string) {
    const existing = await this.findById(productionOrderId);

    // Locked statuses — only allow status-only updates
    const lockedStatuses = ["IN_PRODUCTION", "POST_PRODUCTION", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED"];
    if (lockedStatuses.includes(existing.status || "")) {
      const keys = Object.keys(data).filter((k) => (data as any)[k] !== undefined);
      const allowedExecutionKeys = ["status", "producedQty", "rejectedQty", "scrapQty", "remarks"];
      const isSystemStatusUpdate = keys.every((k) => allowedExecutionKeys.includes(k));
      if (!isSystemStatusUpdate) {
        throw new ApiError(400, "Production Order is locked for editing once production has started.");
      }
    }

    const updateData: any = {};
    const editableStatuses = ["DRAFT", "CREATED", "WAITING_FOR_MATERIAL", "READY_FOR_PLANNING", "WEEKLY_SCHEDULED", "DAILY_PLANNED"];

    if (editableStatuses.includes(existing.status || "")) {
      if (data.orderDate !== undefined) updateData.orderDate = new Date(data.orderDate);
      if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);

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
      if (data.lotNo !== undefined) updateData.lotNo = data.lotNo;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;

      if (data.sourceStoreId !== undefined) {
        if (data.sourceStoreId) {
          const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
          if (!store) throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
        }
        updateData.sourceStoreId = data.sourceStoreId;
      }

      if (data.destinationStoreId !== undefined) {
        if (data.destinationStoreId) {
          const store = await prisma.store.findUnique({ where: { storeId: data.destinationStoreId } });
          if (!store) throw new ApiError(404, `Destination Store with ID ${data.destinationStoreId} not found`);
        }
        updateData.destinationStoreId = data.destinationStoreId;
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

      // Log status change in history
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
      }

      // Sync linked Sales Order
      if (existing.sourceSalesOrderId) {
        await StatusSyncService.syncSalesOrderProductionStatus(tx, existing.sourceSalesOrderId);
      }

      return resultOrder;
    });

    return updatedOrder;
  }

  // ── Start Production ──────────────────────────────────────────────────────
  // STEP 5: Production Start
  // - Status must be DAILY_PLANNED
  // - Auto-create RAW_MATERIAL_ISSUE stock adjustment (once only)
  // - Deduct raw material stock
  // - Insert raw material transactions
  // - Set status to IN_PRODUCTION
  async startProduction(productionOrderId: string, userId?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
    }) as any;

    if (!order) {
      throw new ApiError(404, `Production Order ${productionOrderId} not found`);
    }

    const allowedStartStatuses = ["DAILY_PLANNED", "PARTIAL_COMPLETED", "IN_PRODUCTION", "IN_PROGRESS", "POST_PRODUCTION", "WEEKLY_SCHEDULED"];
    if (!allowedStartStatuses.includes(order.status)) {
      throw new ApiError(
        400,
        `Production can only be started for active orders. Current status: ${order.status}`
      );
    }

    // ✅ Idempotency check: don't issue materials twice
    const existingIssue = await prisma.stockAdjustment.findFirst({
      where: {
        productionOrderId,
        adjustmentType: "RAW_MATERIAL_ISSUE",
        status: { not: "REJECTED" },
      },
    });

    if (existingIssue) {
      // Materials already issued — just update status to IN_PRODUCTION
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.productionOrder.update({
          where: { productionOrderId },
          data: { status: "IN_PRODUCTION", updatedBy: userId },
        });
        await this.addHistory(tx, productionOrderId, "DAILY_PLANNED", "IN_PRODUCTION", userId,
          "Production started (materials already issued)", "PRODUCTION_START");
        return result;
      });
      return updated;
    }

    const rawMaterials: any[] = Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0
      ? order.draftRawMaterials as any[]
      : [];

    if (rawMaterials.length === 0) {
      // No raw materials to issue — still start production
      return await prisma.$transaction(async (tx) => {
        const result = await tx.productionOrder.update({
          where: { productionOrderId },
          data: { status: "IN_PRODUCTION", updatedBy: userId },
        });
        await this.addHistory(tx, productionOrderId, "DAILY_PLANNED", "IN_PRODUCTION", userId,
          "Production started (no raw materials configured)", "PRODUCTION_START");
        return result;
      });
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create StockAdjustment header (RAW_MATERIAL_ISSUE)
      const now = new Date();
      const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const adjustmentNumber = `RMI-${productionOrderId}-${dateStr}`;

      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: now,
          adjustmentType: "RAW_MATERIAL_ISSUE",
          productionOrderId,
          reason: `Raw material issued for Production Order: ${productionOrderId} (Production Start)`,
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: now,
          createdBy: userId,
          autoGenerated: true,
          sourceDocument: "PRODUCTION_ORDER",
          sourceDocId: productionOrderId,
        },
      });

      // 2. Process each raw material
      for (const rm of rawMaterials) {
        const { rawMaterialId, requiredQty } = rm;
        const qty = Number(requiredQty);
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
            `Insufficient stock for raw material "${stock.materialName}" (${rawMaterialId}). Available: ${Number(stock.onHandQty).toFixed(3)}, Required: ${qty.toFixed(3)}`
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
            remarks: `Issued for Production Order ${productionOrderId} on production start`,
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
            remarks: `Issued for Production Order ${productionOrderId} on production start`,
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
        "DAILY_PLANNED",
        "IN_PRODUCTION",
        userId,
        "Production started. Raw materials issued.",
        "PRODUCTION_START",
        { stockAdjustmentId: stockAdjustment.id.toString(), rawMaterialsIssued: rawMaterials.length }
      );

      return result;
    });
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

      if (order.sourceSalesOrderId) {
        await StatusSyncService.syncSalesOrderProductionStatus(tx, order.sourceSalesOrderId);
      }

      return result;
    });
  }

  // ── Manual Material Issue (legacy/partial) ────────────────────────────────
  // Kept for cases where partial material issue is needed separately.
  // Now gated: only READY_FOR_PLANNING or WEEKLY_SCHEDULED orders.
  async issueMaterials(
    productionOrderId: string,
    data: { items: { rawMaterialId: string; storeId: string; qty: number; remarks?: string }[] },
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
        const { rawMaterialId, storeId, qty, remarks } = item;

        const rm = await tx.rawMaterial.findUnique({ where: { rawMaterialId } });
        if (!rm) throw new ApiError(404, `Raw Material with ID ${rawMaterialId} not found`);

        const currentQty = rm.onHandQty;
        const newOnHand = Number(rm.onHandQty) - qty;
        const newReserved = Math.max(0, Number(rm.reservedQty) - qty);

        await tx.rawMaterial.update({
          where: { rawMaterialId },
          data: { onHandQty: newOnHand, reservedQty: newReserved, updatedBy: userId },
        });

        await tx.rawMaterialTransaction.create({
          data: {
            storeId,
            rawMaterialId,
            txnType: "RAW_MATERIAL_ISSUE",
            qty: -qty,
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
            difference: -qty,
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
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async delete(productionOrderId: string) {
    const existing = await this.findById(productionOrderId);

    const undeletableStatuses = ["IN_PRODUCTION", "POST_PRODUCTION", "PARTIAL_COMPLETED", "READY_FOR_DISPATCH", "DISPATCHED", "WEEKLY_SCHEDULED", "DAILY_PLANNED"];
    if (undeletableStatuses.includes(existing.status)) {
      throw new ApiError(400, `Production Order cannot be deleted with status "${existing.status}". Only CREATED, WAITING_FOR_MATERIAL, or READY_FOR_PLANNING orders can be deleted.`);
    }

    if (existing.sourceSalesOrderId) {
      throw new ApiError(400, "Production Orders linked to Sales Orders cannot be deleted directly. Please cancel the Sales Order instead.");
    }

    await prisma.productionOrder.update({
      where: { productionOrderId },
      data: { status: "CANCELLED" },
    });

    return { message: "Production order cancelled successfully" };
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
    return history;
  }
}

export default new ProductionOrderService();
