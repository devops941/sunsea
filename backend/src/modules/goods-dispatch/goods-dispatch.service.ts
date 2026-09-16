import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateGoodsDispatchInput, UpdateGoodsDispatchInput, GateApproveInput, StoreReceiveInput } from "./goods-dispatch.validation";
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
      // Dispatch is only allowed after production is fully completed
      // POST_PRODUCTION is still in-progress — dispatch only from READY_FOR_DISPATCH onwards
      status: { in: ["READY_FOR_DISPATCH", "COMPLETED", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED"] },
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
      where: {
        ...where,
        // ✅ Eligible for dispatch: production started and at least some qty produced
        // IN_PROGRESS is set by syncProductionOrderQuantities when target not yet met
        status: { in: ["IN_PROGRESS", "IN_PRODUCTION", "POST_PRODUCTION", "READY_FOR_DISPATCH", "COMPLETED", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED"] },
      },
      include: {
        productItem: true,
        Machine: true,
        goodsDispatchItems: {
          // Only count items from dispatches that are NOT rejected
          where: {
            dispatch: {
              status: {
                notIn: ["GATE_REJECTED", "STORE_REJECTED"],
              },
            },
          },
          select: {
            dispatchQty: true,
          },
        },
        dailyProductionPlans: {
          select: {
            status: true,
            hourlyProductions: {
              select: { totalQtyProduced: true }
            }
          }
        }
      },
      orderBy: { orderDate: "desc" },
    });

    return (orders as any[]).map((o: any) => {
      const totalDispatched = (o.goodsDispatchItems || []).reduce(
        (sum: number, item: any) => sum + Number(item.dispatchQty),
        0
      );

      // Use raw producedQty directly — no scrap/rejected deduction
      let dispatchableProducedQty = Number(o.producedQty || 0);

      // READY_FOR_DISPATCH means production is complete. If producedQty was not synced
      // (e.g. daily-plan completion path without hourly records), fall back to targetQty.
      if (dispatchableProducedQty === 0 && o.status === "READY_FOR_DISPATCH") {
        dispatchableProducedQty = Number(o.targetQty || 0);
      }

      const pendingQty = Math.max(0, dispatchableProducedQty - totalDispatched);
      return {
        productionOrderId: o.productionOrderId,
        orderDate: o.orderDate,
        dueDate: o.dueDate,
        batchNo: o.batchNo,
        uom: o.uom,
        status: o.status,
        producedQty: dispatchableProducedQty, // Provide the dispatchable qty instead of raw producedQty
        totalDispatchedQty: totalDispatched,
        pendingDispatchQty: pendingQty,
        productItem: o.productItem,
        machine: o.Machine,
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

      // ✅ STEP 7–8: IN_PRODUCTION and later statuses can be dispatched
      if (!['IN_PROGRESS', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'COMPLETED', 'PARTIAL_COMPLETED', 'COMPLETED_WITH_SHORTFALL', 'CLOSED'].includes(po.status)) {
        throw new ApiError(
          400,
          `Production Order ${item.productionOrderId} is not eligible for dispatch. Current status: ${po.status}`
        );
      }

      const totalDispatched = po.goodsDispatchItems.reduce(
        (sum, d) => sum + Number(d.dispatchQty),
        0
      );
      // Fallback: if producedQty was not synced for READY_FOR_DISPATCH orders, use targetQty
      const effectiveProducedQty = Number(po.producedQty) === 0 && po.status === "READY_FOR_DISPATCH"
        ? Number(po.targetQty)
        : Number(po.producedQty);
      const pendingQty = effectiveProducedQty - totalDispatched;

      if (item.dispatchQty > pendingQty) {
        throw new ApiError(
          400,
          `Dispatch quantity (${item.dispatchQty}) exceeds pending quantity (${pendingQty.toFixed(3)}) for PO ${item.productionOrderId}`
        );
      }
    }

    const dispatchNumber = await this.getNextDispatchNumber();

    // If every item bypasses gate → whole dispatch is immediately WAREHOUSE_RECEIVED
    const allBypass = data.items.every((i) => i.bypassGate);
    const initialStatus = allBypass ? "WAREHOUSE_RECEIVED" : "PENDING_GATE_APPROVAL";

    const dispatch = await prisma.goodsDispatch.create({
      data: {
        dispatchNumber,
        dispatchDate: new Date(data.dispatchDate),
        vehicleNumber: data.vehicleNumber,
        driverName: data.driverName,
        driverMobile: data.driverMobile,
        dcNumber: data.dcNumber,
        loadingTime: data.loadingTime,
        remarks: data.remarks,
        destinationStoreId: data.destinationStoreId,
        status: initialStatus,
        createdBy: userId,
        updatedBy: userId,
        ...(allBypass && {
          storeReceivedBy: userId,
          storeReceivedAt: new Date(),
          storeRemarks: "Direct inventory — gate bypassed",
        }),
        items: {
          create: data.items.map((item) => ({
            productionOrderId: item.productionOrderId,
            productItemId: BigInt(item.productItemId),
            dispatchQty: item.dispatchQty,
            uom: item.uom,
            bypassGate: item.bypassGate ?? false,
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

    // ── Immediately settle stock for all bypassGate items ─────────────────────
    const bypassItems = data.items.filter((i) => i.bypassGate);
    if (bypassItems.length > 0) {
      const now = new Date();
      const storeId = data.destinationStoreId;

      await prisma.$transaction(async (tx) => {
        const createdItems = await tx.goodsDispatchItem.findMany({
          where: { dispatchId: dispatch.id },
          include: { productionOrder: true },
        });

        // Create one StockAdjustment for all bypassed items in this dispatch
        const adjustmentNumber = await StockAdjustmentService.getNextAdjustmentNumber();
        const stockAdjustment = storeId
          ? await tx.stockAdjustment.create({
              data: {
                adjustmentNumber,
                adjustmentDate: now,
                adjustmentType: "STOCK_INCREASE",
                reason: `Direct Stock Entry: ${dispatch.dispatchNumber}`,
                status: "APPROVED",
                approvedBy: userId,
                approvedAt: now,
                createdBy: userId,
                updatedBy: userId,
                sourceDocument: "GOODS_DISPATCH",
                sourceDocId: dispatch.dispatchNumber,
                autoGenerated: true,
                productionOrderId: bypassItems[0]?.productionOrderId ?? null,
              },
            })
          : null;

        for (const item of bypassItems) {
          const createdItem = createdItems.find(
            (ci) => ci.productionOrderId === item.productionOrderId
          );
          if (!createdItem) continue;

          const receivedQty = item.dispatchQty;

          // Mark item as received
          await tx.goodsDispatchItem.update({
            where: { id: createdItem.id },
            data: { receivedQty },
          });

          if (!storeId) continue;

          // Fetch current stock for the adjustment item record
          const currentStock = await tx.finishedGoodsStock.findUnique({
            where: { storeId_productItemId: { storeId, productItemId: createdItem.productItemId } },
          });
          const currentQty = currentStock ? Number(currentStock.onHandQty) : 0;

          // StockAdjustmentItem for audit trail
          if (stockAdjustment) {
            await tx.stockAdjustmentItem.create({
              data: {
                stockAdjustmentId: stockAdjustment.id,
                itemType: "FINISHED_GOODS",
                productItemId: createdItem.productItemId,
                storeId,
                currentQty,
                adjustedQty: currentQty + receivedQty,
                difference: receivedQty,
                remarks: `Direct via Dispatch: ${dispatch.dispatchNumber}`,
                batchNo: createdItem.productionOrder?.batchNo ?? null,
              },
            });
          }

          // Upsert FinishedGoodsStock
          await tx.finishedGoodsStock.upsert({
            where: { storeId_productItemId: { storeId, productItemId: createdItem.productItemId } },
            create: { storeId, productItemId: createdItem.productItemId, onHandQty: receivedQty },
            update: { onHandQty: { increment: receivedQty } },
          });

          // Create FinishedGoodsTransaction
          await tx.finishedGoodsTransaction.create({
            data: {
              txnDateTime: now,
              storeId,
              productItemId: createdItem.productItemId,
              txnType: "PRODUCTION_RECEIPT",
              qty: receivedQty,
              productionOrderId: item.productionOrderId,
              relatedDocNo: dispatch.dispatchNumber,
              remarks: `Direct Dispatch (Gate Bypassed): ${dispatch.dispatchNumber}`,
              createdBy: userId,
            },
          });

          // Update Production Order status
          const poRecord = await tx.productionOrder.findUnique({
            where: { productionOrderId: item.productionOrderId },
          });
          if (poRecord) {
            const targetQty = Number(poRecord.targetQty || 0);
            const producedQty = Number(poRecord.producedQty || 0);

            const allDispatches = await tx.goodsDispatchItem.aggregate({
              where: { productionOrderId: item.productionOrderId },
              _sum: { dispatchQty: true },
            });
            const totalDispatched = Number(allDispatches._sum.dispatchQty || 0);

            const isFullyDispatched =
              targetQty > 0 &&
              (totalDispatched >= targetQty || (producedQty > 0 && totalDispatched >= producedQty));
            const isShortClosed = ["COMPLETED_WITH_SHORTFALL", "CLOSED"].includes(poRecord.status);
            const newPoStatus = isFullyDispatched
              ? "DISPATCHED"
              : isShortClosed
              ? poRecord.status
              : "PARTIAL_COMPLETED";

            if (poRecord.status !== newPoStatus) {
              await tx.productionOrder.update({
                where: { productionOrderId: item.productionOrderId },
                data: { status: newPoStatus, updatedBy: userId },
              });
              await tx.productionOrderHistory.create({
                data: {
                  productionOrderId: item.productionOrderId,
                  fromStatus: poRecord.status,
                  toStatus: newPoStatus,
                  changedBy: userId,
                  remarks: isFullyDispatched
                    ? `Goods fully dispatched directly to inventory (${totalDispatched}/${targetQty} pcs) via ${dispatch.dispatchNumber}. Gate bypassed.`
                    : `Partial goods dispatched directly to inventory (${totalDispatched}/${targetQty} pcs) via ${dispatch.dispatchNumber}. Gate bypassed.`,
                  action: isFullyDispatched ? "DISPATCH_COMPLETE" : "DISPATCH_PARTIAL",
                  metadata: {
                    dispatchNumber: dispatch.dispatchNumber,
                    receivedQty,
                    totalDispatched,
                    targetQty,
                    storeId,
                    bypassGate: true,
                  },
                },
              });
            }
          }
        }
      });
    }

    return this.findById(Number(dispatch.id));
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
    const where: any = {
      // Exclude pure direct-to-stock dispatches (all items bypassed gate)
      NOT: { items: { every: { bypassGate: true } } },
    };

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
        { dcNumber: { contains: filters.search, mode: "insensitive" } },
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

  // ── Update Dispatch ────────────────────────────────────────────────────────
  static async update(id: number, data: UpdateGoodsDispatchInput, userId: string) {
    const existing = await prisma.goodsDispatch.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) throw new ApiError(404, "Goods Dispatch not found");

    const updated = await prisma.goodsDispatch.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.dispatchDate && { dispatchDate: new Date(data.dispatchDate) }),
        ...(data.vehicleNumber !== undefined && { vehicleNumber: data.vehicleNumber }),
        ...(data.driverName !== undefined && { driverName: data.driverName }),
        ...(data.driverMobile !== undefined && { driverMobile: data.driverMobile }),
        ...(data.dcNumber !== undefined && { dcNumber: data.dcNumber }),
        ...(data.loadingTime !== undefined && { loadingTime: data.loadingTime }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.destinationStoreId !== undefined && { destinationStoreId: data.destinationStoreId }),
        updatedBy: userId,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, productName: true, productCode: true } },
            productionOrder: { select: { productionOrderId: true, batchNo: true } },
          },
        },
        store: { select: { storeName: true, storeId: true } },
      },
    });

    return updated;
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
    }

    // ── APPROVE: update stock ──────────────────────────────────────────────────
    const now = new Date();
    // Use string keys to avoid BigInt vs Number mismatch when looking up by item ID
    const receivedItemsMap = new Map<string, number>();
    (data.receivedItems || []).forEach((ri) => {
      receivedItemsMap.set(String(ri.itemId), ri.receivedQty);
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

      // Only process items that did NOT bypass gate — bypass items were already added to stock on dispatch creation
      const itemsToProcess = dispatch.items.filter((i: any) => !i.bypassGate);

      // Create a StockAdjustment for the Dispatch (only if there are non-bypass items)
      const firstPoId = itemsToProcess.find((i) => i.productionOrderId)?.productionOrderId || null;
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
          productionOrderId: firstPoId,
        },
      });

      for (const item of itemsToProcess) {
        const receivedQty =
          receivedItemsMap.size > 0
            ? receivedItemsMap.get(String(item.id)) ?? Number(item.dispatchQty)
            : Number(item.dispatchQty);

        // Update received qty on item
        await tx.goodsDispatchItem.update({
          where: { id: item.id },
          data: { receivedQty },
        });

        const storeId = dispatch.destinationStoreId;
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

        // ✅ STEP 8: Upsert FinishedGoodsStock HERE (not at COMPLETED)
        // This is the correct ERP point to create FG stock — when goods physically arrive at warehouse
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

        // ✅ STEP 8 FINAL: Mark Production Order status (DISPATCHED if target met, PARTIAL_COMPLETED if partial)
        if (item.productionOrderId) {
          const poRecord = await tx.productionOrder.findUnique({
            where: { productionOrderId: item.productionOrderId },
          });
          if (poRecord) {
            const targetQty = Number(poRecord.targetQty || 0);
            const producedQty = Number(poRecord.producedQty || 0);

            // Sum up total dispatched quantity for this PO across all dispatch records
            const allDispatches = await tx.goodsDispatchItem.aggregate({
              where: { productionOrderId: item.productionOrderId },
              _sum: { dispatchQty: true },
            });
            const totalDispatched = Number(allDispatches._sum.dispatchQty || 0);

            const isShortClosed = ["COMPLETED_WITH_SHORTFALL", "CLOSED"].includes(poRecord.status);
            const isFullyDispatched = targetQty > 0 && (
              totalDispatched >= targetQty ||
              (producedQty > 0 && totalDispatched >= producedQty)
            );
            const newPoStatus = isFullyDispatched ? "DISPATCHED" : (isShortClosed ? poRecord.status : "PARTIAL_COMPLETED");

            if (poRecord.status !== newPoStatus) {
              await tx.productionOrder.update({
                where: { productionOrderId: item.productionOrderId },
                data: { status: newPoStatus, updatedBy: userId },
              });
              await tx.productionOrderHistory.create({
                data: {
                  productionOrderId: item.productionOrderId,
                  fromStatus: poRecord.status,
                  toStatus: newPoStatus,
                  changedBy: userId,
                  remarks: isFullyDispatched
                    ? `Goods fully dispatched (${totalDispatched}/${targetQty} pcs) via ${dispatch.dispatchNumber}.`
                    : `Partial goods dispatched (${totalDispatched}/${targetQty} pcs) via ${dispatch.dispatchNumber}. Status updated to PARTIAL_COMPLETED.`,
                  action: isFullyDispatched ? "DISPATCH_COMPLETE" : "DISPATCH_PARTIAL",
                  metadata: {
                    dispatchNumber: dispatch.dispatchNumber,
                    receivedQty,
                    totalDispatched,
                    targetQty,
                    storeId,
                  },
                },
              });
            }
          }
        }
      }
    });

    return this.findById(id);
  }
}
