import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateGoodsDispatchInput, GateApproveInput, StoreReceiveInput } from "./goods-dispatch.validation";
import { StockAdjustmentService } from "../stock-adjustment/stock-adjustment.service";

export class GoodsDispatchService {
  // ── Generate next dispatch number ──────────────────────────────────────────
  static async getNextDispatchNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GD-${year}-`;

    const last = await prisma.goodsDispatch.findFirst({
      where: { dispatchNumber: { startsWith: prefix } },
      orderBy: { dispatchNumber: "desc" },
      select: { dispatchNumber: true },
    });

    let seq = 1;
    if (last?.dispatchNumber) {
      const parts = last.dispatchNumber.split("-");
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }

  // ── Get eligible Production Orders (COMPLETED) ──────────────
  static async getEligibleProductionOrders(filters: {
    search?: string;
    productItemId?: string;
    machineId?: string;
    batchNo?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {
      status: "COMPLETED",
    };

    if (filters.productItemId) where.productItemId = BigInt(filters.productItemId);
    if (filters.machineId) where.machineMachineId = filters.machineId;
    if (filters.batchNo) where.batchNo = { contains: filters.batchNo, mode: "insensitive" };
    if (filters.dateFrom || filters.dateTo) {
      where.orderDate = {};
      if (filters.dateFrom) where.orderDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.orderDate.lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      where.OR = [
        { productionOrderId: { contains: filters.search, mode: "insensitive" } },
        { batchNo: { contains: filters.search, mode: "insensitive" } },
        { productItem: { productName: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        productItem: { select: { id: true, productName: true, productCode: true, uom: true } },
        Machine: { select: { machineId: true, machineName: true } },
        goodsDispatchItems: {
          where: {
            dispatch: {
              status: {
                notIn: ["GATE_REJECTED", "STORE_REJECTED"],
              },
            },
          },
          select: { dispatchQty: true },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    return orders.map((o) => {
      const totalDispatched = o.goodsDispatchItems.reduce(
        (sum, item) => sum + Number(item.dispatchQty),
        0
      );
      const pendingQty = Math.max(0, Number(o.producedQty) - totalDispatched);
      return {
        productionOrderId: o.productionOrderId,
        orderDate: o.orderDate,
        dueDate: o.dueDate,
        batchNo: o.batchNo,
        lotNo: o.lotNo,
        uom: o.uom,
        status: o.status,
        producedQty: Number(o.producedQty),
        totalDispatchedQty: totalDispatched,
        pendingDispatchQty: pendingQty,
        productItem: o.productItem,
        machine: o.Machine,
        destinationStoreId: o.destinationStoreId,
      };
    }).filter(o => o.pendingDispatchQty > 0);
  }

  // ── Create Dispatch ─────────────────────────────────────────────────────────
  static async create(data: CreateGoodsDispatchInput, userId: string) {
    // Validate each item
    for (const item of data.items) {
      const po = await prisma.productionOrder.findUnique({
        where: { productionOrderId: item.productionOrderId },
        include: {
          goodsDispatchItems: {
            where: {
              dispatch: {
                status: {
                  notIn: ["GATE_REJECTED", "STORE_REJECTED"],
                },
              },
            },
            select: { dispatchQty: true },
          },
        },
      });

      if (!po) {
        throw new ApiError(404, `Production Order ${item.productionOrderId} not found`);
      }
      if (po.status !== "COMPLETED") {
        throw new ApiError(
          400,
          `Production Order ${item.productionOrderId} is not eligible for dispatch. Status: ${po.status}`
        );
      }

      const totalDispatched = po.goodsDispatchItems.reduce(
        (sum, d) => sum + Number(d.dispatchQty),
        0
      );
      const pendingQty = Number(po.producedQty) - totalDispatched;

      if (item.dispatchQty > pendingQty) {
        throw new ApiError(
          400,
          `Dispatch quantity (${item.dispatchQty}) exceeds pending quantity (${pendingQty.toFixed(3)}) for PO ${item.productionOrderId}`
        );
      }
    }

    const dispatchNumber = await this.getNextDispatchNumber();

    const dispatch = await prisma.goodsDispatch.create({
      data: {
        dispatchNumber,
        dispatchDate: new Date(data.dispatchDate),
        vehicleNumber: data.vehicleNumber,
        driverName: data.driverName,
        driverMobile: data.driverMobile,
        transportName: data.transportName,
        loadingTime: data.loadingTime,
        remarks: data.remarks,
        destinationStoreId: data.destinationStoreId,
        status: "PENDING_GATE_APPROVAL",
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: data.items.map((item) => ({
            productionOrderId: item.productionOrderId,
            productItemId: BigInt(item.productItemId),
            dispatchQty: item.dispatchQty,
            uom: item.uom,
            remarks: item.remarks,
          })),
        },
      },
      include: {
        items: {
          include: {
            productionOrder: { select: { productionOrderId: true, batchNo: true } },
            product: { select: { productName: true, productCode: true } },
          },
        },
        store: { select: { storeName: true, storeId: true } },
      },
    });

    return dispatch;
  }

  // ── Find All ────────────────────────────────────────────────────────────────
  static async findAll(filters: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 10 } = filters;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.dispatchDate = {};
      if (filters.dateFrom) where.dispatchDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dispatchDate.lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      where.OR = [
        { dispatchNumber: { contains: filters.search, mode: "insensitive" } },
        { vehicleNumber: { contains: filters.search, mode: "insensitive" } },
        { driverName: { contains: filters.search, mode: "insensitive" } },
        { transportName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.goodsDispatch.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: { select: { productName: true, productCode: true } },
              productionOrder: { select: { productionOrderId: true, batchNo: true } },
            },
          },
          store: { select: { storeName: true, storeId: true } },
        },
      }),
      prisma.goodsDispatch.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ── Find By ID ──────────────────────────────────────────────────────────────
  static async findById(id: number) {
    const dispatch = await prisma.goodsDispatch.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { productName: true, productCode: true } },
            productionOrder: {
              select: {
                productionOrderId: true,
                batchNo: true,
                producedQty: true,
                uom: true,
                orderDate: true,
                productItem: { select: { productName: true, productCode: true } },
              },
            },
          },
        },
        store: { select: { storeName: true, storeId: true } },
      },
    });

    if (!dispatch) throw new ApiError(404, "Goods Dispatch not found");
    return dispatch;
  }

  // ── Gate Approve / Reject ────────────────────────────────────────────────────
  static async gateApprove(id: number, data: GateApproveInput, userId: string) {
    const dispatch = await prisma.goodsDispatch.findUnique({ where: { id } });
    if (!dispatch) throw new ApiError(404, "Goods Dispatch not found");
    if (dispatch.status !== "PENDING_GATE_APPROVAL") {
      throw new ApiError(400, `Cannot gate-approve a dispatch with status: ${dispatch.status}`);
    }

    const newStatus = data.action === "APPROVE" ? "PENDING_STORE_RECEIPT" : "GATE_REJECTED";

    return prisma.goodsDispatch.update({
      where: { id },
      data: {
        status: newStatus,
        gateApprovedBy: userId,
        gateApprovedAt: new Date(),
        gateRemarks: data.remarks,
        updatedBy: userId,
      },
      include: { items: true, store: true },
    });
  }

  // ── Store Receive / Reject ──────────────────────────────────────────────────
  static async storeReceive(id: number, data: StoreReceiveInput, userId: string) {
    const dispatch = await prisma.goodsDispatch.findUnique({
      where: { id },
      include: { items: { include: { productionOrder: true } } },
    });
    if (!dispatch) throw new ApiError(404, "Goods Dispatch not found");
    if (dispatch.status !== "PENDING_STORE_RECEIPT") {
      throw new ApiError(400, `Cannot process store receipt for dispatch with status: ${dispatch.status}`);
    }

    if (data.action === "REJECT") {
      return prisma.goodsDispatch.update({
        where: { id },
        data: {
          status: "STORE_REJECTED",
          storeReceivedBy: userId,
          storeReceivedAt: new Date(),
          storeRemarks: data.remarks,
          updatedBy: userId,
        },
        include: { items: true },
      });
    }

    // ── APPROVE: update stock ──────────────────────────────────────────────────
    const now = new Date();
    const receivedItemsMap = new Map<number, number>();
    (data.receivedItems || []).forEach((ri) => {
      receivedItemsMap.set(ri.itemId, ri.receivedQty);
    });

    await prisma.$transaction(async (tx) => {
      // Update dispatch status + item received qtys
      await tx.goodsDispatch.update({
        where: { id },
        data: {
          status: "WAREHOUSE_RECEIVED",
          storeReceivedBy: userId,
          storeReceivedAt: now,
          storeRemarks: data.remarks,
          updatedBy: userId,
        },
      });

      // Create a StockAdjustment for the Dispatch
      const adjustmentNumber = await StockAdjustmentService.getNextAdjustmentNumber();
      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: now,
          adjustmentType: "STOCK_INCREASE",
          reason: `Goods Dispatch Received: ${dispatch.dispatchNumber}`,
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: now,
          createdBy: userId,
          updatedBy: userId,
          sourceDocument: "GOODS_DISPATCH",
          sourceDocId: dispatch.dispatchNumber,
          autoGenerated: true,
        },
      });

      for (const item of dispatch.items) {
        const receivedQty =
          receivedItemsMap.size > 0
            ? receivedItemsMap.get(Number(item.id)) ?? Number(item.dispatchQty)
            : Number(item.dispatchQty);

        // Update received qty on item
        await tx.goodsDispatchItem.update({
          where: { id: item.id },
          data: { receivedQty },
        });

        const storeId = dispatch.destinationStoreId || item.productionOrder.destinationStoreId;
        if (!storeId) continue;

        // Fetch current stock for StockAdjustmentItem
        const currentStock = await tx.finishedGoodsStock.findUnique({
          where: { storeId_productItemId: { storeId, productItemId: item.productItemId } },
        });
        const currentQty = currentStock ? Number(currentStock.onHandQty) : 0;
        const adjustedQty = currentQty + receivedQty;

        // Create StockAdjustmentItem
        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: stockAdjustment.id,
            itemType: "FINISHED_GOODS",
            productItemId: item.productItemId,
            storeId,
            currentQty,
            adjustedQty,
            difference: receivedQty,
            remarks: `Received via Dispatch: ${dispatch.dispatchNumber}`,
            batchNo: item.productionOrder.batchNo,
          },
        });

        // Upsert FinishedGoodsStock
        await tx.finishedGoodsStock.upsert({
          where: { storeId_productItemId: { storeId, productItemId: item.productItemId } },
          create: { storeId, productItemId: item.productItemId, onHandQty: receivedQty },
          update: { onHandQty: { increment: receivedQty } },
        });

        // Create FinishedGoodsTransaction
        await tx.finishedGoodsTransaction.create({
          data: {
            txnDateTime: now,
            storeId,
            productItemId: item.productItemId,
            txnType: "PRODUCTION_RECEIPT",
            qty: receivedQty,
            productionOrderId: item.productionOrderId,
            relatedDocNo: dispatch.dispatchNumber,
            remarks: `Dispatch: ${dispatch.dispatchNumber} | Vehicle: ${dispatch.vehicleNumber}`,
            createdBy: userId,
          },
        });
      }
    });

    return this.findById(id);
  }
}
