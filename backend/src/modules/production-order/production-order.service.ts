import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateProductionOrderInput, UpdateProductionOrderInput, ProductionOrderQueryInput } from "./production-order.validation";
import { Prisma } from "@prisma/client";

class ProductionOrderService {
  async create(data: CreateProductionOrderInput, userId?: string) {
    const productItemId = BigInt(data.productItemId);
    const sourceSalesOrderLineId = data.sourceSalesOrderLineId ? BigInt(data.sourceSalesOrderLineId) : null;

    // Verify unique productionOrderId
    const existing = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (existing) {
      throw new ApiError(409, `Production Order with ID ${data.productionOrderId} already exists`);
    }

    // Validate Dependencies
    const product = await prisma.product.findUnique({
      where: { id: productItemId },
      include: { productionSteps: { orderBy: { stepOrder: 'asc' } } }
    });
    if (!product) {
      throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
    }

    const firstStep = product.productionSteps && product.productionSteps.length > 0 
      ? product.productionSteps[0] 
      : null;

    const weightPerPieceUsed = product.weightPerPiece ? Number(product.weightPerPiece) : 0;
    const requiredRawMaterialQty = Number(data.targetQty) * weightPerPieceUsed;

    if (data.billOfMaterialId) {
      // @ts-ignore - Prisma schema lacks billOfMaterial model definition but it is required by instructions
      const bom = await (prisma as any).billOfMaterial.findFirst({
        where: { id: Number(data.billOfMaterialId) }
      });
      if (!bom) {
        throw new ApiError(404, `Bill Of Material with ID ${data.billOfMaterialId} not found`);
      }
    }

    if (data.sourceSalesOrderId) {
      // Assuming sourceSalesOrderId maps to orderNo or id
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
          ...(sourceSalesOrderLineId ? { sourceSalesOrderLineId } : {})
        }
      });
      if (existingPoForSo) {
        throw new ApiError(400, "A Production Order has already been created for this item in the Sales Order.");
      }
    }

    if (data.sourceStoreId) {
      const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
      if (!store) {
        throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
      }
    }

    if (data.destinationStoreId) {
      const store = await prisma.store.findUnique({ where: { storeId: data.destinationStoreId } });
      if (!store) {
        throw new ApiError(404, `Destination Store with ID ${data.destinationStoreId} not found`);
      }
    }

    if (data.machineMachineId) {
      const machine = await prisma.machine.findUnique({ where: { machineId: data.machineMachineId } });
      if (!machine) {
        throw new ApiError(404, `Machine with ID ${data.machineMachineId} not found`);
      }
    }

    // Validate Raw Materials Availability
    let calculatedStatus = data.status ?? "PLANNED";
    let rmMoves: { rawMaterialId: string; qty: number }[] = [];

    if (calculatedStatus !== "DRAFT" && data.rawMaterials && data.rawMaterials.length > 0) {
      const rmCheck = await this.checkRawMaterialAvailability(data.rawMaterials);
      calculatedStatus = rmCheck.allAvailable ? "RM_AVAILABLE" : "RM_PENDING";
      rmMoves = rmCheck.rmMoves;
    }

    return prisma.$transaction(async (tx) => {
      const createdOrder = await tx.productionOrder.create({
        data: {
          productionOrderId: data.productionOrderId,
          orderDate: new Date(data.orderDate),
          dueDate: new Date(data.dueDate),
          productItemId,
          targetQty: data.targetQty,
          producedQty: data.producedQty ?? 0,
          rejectedQty: data.rejectedQty ?? 0,
          scrapQty: data.scrapQty ?? 0,
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
          status: calculatedStatus,
          remarks: data.remarks,
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt ? new Date(data.approvedAt) : undefined,
          createdBy: userId,
          weightPerPieceUsed,
          requiredRawMaterialQty,
          draftRawMaterials: data.rawMaterials as any,
          currentStepIndex: 0,
          currentProductionStep: "Production",
        } as any,
        include: {
          productItem: true,
        },
      });

      // Apply raw material stock reservations
      for (const move of rmMoves) {
        await tx.rawMaterial.update({
          where: { rawMaterialId: move.rawMaterialId },
          data: {
            reservedQty: {
              increment: move.qty,
            },
          },
        });
      }

      if (data.sourceSalesOrderId) {
        let salesOrderIdToUpdate = null;
        if (!isNaN(Number(data.sourceSalesOrderId))) {
          salesOrderIdToUpdate = Number(data.sourceSalesOrderId);
        } else {
          const so = await tx.salesOrder.findUnique({ where: { orderNo: data.sourceSalesOrderId } });
          if (so) salesOrderIdToUpdate = so.id;
        }

        if (salesOrderIdToUpdate) {
          await tx.salesOrder.update({
            where: { id: salesOrderIdToUpdate },
            // @ts-ignore - Prisma client needs to be regenerated to recognize this field
            data: { productionStatus: calculatedStatus === "DRAFT" ? "PRODUCTION_DRAFT" : "PRODUCTION_CREATED" }
          });
        }
      }

      return createdOrder;
    });
  }

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

    if (productItemId) {
      where.productItemId = BigInt(productItemId);
    }

    if (productionOrderId) {
      where.productionOrderId = { contains: productionOrderId, mode: "insensitive" };
    }

    if (sourceSalesOrderId) {
      where.sourceSalesOrderId = sourceSalesOrderId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { productionOrderId: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
        { sourceSalesOrderId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) {
        where.orderDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.orderDate.lte = new Date(toDate);
      }
    }

    const [total, items] = await Promise.all([
      prisma.productionOrder.count({ where }),
      prisma.productionOrder.findMany({
        where,
        skip,
        take,
        include: {
          productItem: true,
          Machine: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // Fetch related Sales Orders to enrich the response
    const soIdsOrNos = Array.from(new Set(items.map(i => i.sourceSalesOrderId).filter(Boolean))) as string[];
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        OR: [
          { id: { in: soIdsOrNos.map(id => Number(id)).filter(id => !isNaN(id)) } },
          { orderNo: { in: soIdsOrNos } }
        ]
      },
      include: { 
        customer: true,
        items: true
      }
    });

    const salesOrderMap = new Map(
      salesOrders.flatMap(so => [
        [so.id.toString(), so],
        [so.orderNo, so]
      ])
    );

    // Convert BigInts for JSON response and append Sales Order details
    const formattedItems = items.map(item => {
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
        salesOrderDetails: so ? {
          orderNo: so.orderNo,
          customerName: so.customer?.firmName || so.customer?.displayName || 'Unknown'
        } : null
      };
    });

    return {
      data: formattedItems,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  }

  async findById(productionOrderId: string) {
    const order = (await prisma.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        productItem: {
          include: {
            uom: true,
          }
        },
        finishedGoodsTransactions: true,
        Machine: true,
      },
    })) as any;

    if (!order) {
      throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);
    }

    // Fetch all active raw materials to get current inventory levels
    const activeRawMaterials = await prisma.rawMaterial.findMany({
      where: { isActive: true }
    });
    const rmMap = new Map(activeRawMaterials.map(rm => [rm.rawMaterialId, rm]));

    let products: any[] = [];

    if (order.sourceSalesOrderId) {
      let salesOrder = null;
      if (!isNaN(Number(order.sourceSalesOrderId))) {
        salesOrder = await prisma.salesOrder.findUnique({
          where: { id: Number(order.sourceSalesOrderId) },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    uom: true,
                  }
                }
              }
            },
            customer: true,
          }
        });
      }
      if (!salesOrder) {
        salesOrder = await prisma.salesOrder.findUnique({
          where: { orderNo: order.sourceSalesOrderId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    uom: true,
                  }
                }
              }
            },
            customer: true,
          }
        });
      }

      if (salesOrder) {
        products = await Promise.all(salesOrder.items.map(async (item) => {
          const productId = item.productId;
          const quantity = Number(item.quantity);
          
          let bomItems: any[] = [];
          try {
            // @ts-ignore
            bomItems = await (prisma as any).billOfMaterial.findMany({
              where: { productId },
              include: { rawMaterial: true }
            });
          } catch (e) {
            bomItems = [];
          }

          let requiredRms: any[] = [];
          if (bomItems && bomItems.length > 0) {
            requiredRms = bomItems.map(bi => {
              const currentRm = rmMap.get(bi.rawMaterialId) || bi.rawMaterial;
              const requiredQty = Number(bi.requiredQuantity) * quantity;
              const availableStock = currentRm ? Number(currentRm.onHandQty) : 0;
              return {
                rawMaterialId: bi.rawMaterialId,
                materialName: currentRm?.materialName || bi.rawMaterial?.materialName || bi.rawMaterialId,
                requiredQty,
                availableStock,
                status: availableStock >= requiredQty ? "AVAILABLE" : "INSUFFICIENT"
              };
            });
          } else {
            const isSelectedLine = productId.toString() === order.productItemId.toString();
            const weightPerPiece = isSelectedLine && order.weightPerPieceUsed !== null && order.weightPerPieceUsed !== undefined
              ? Number(order.weightPerPieceUsed)
              : Number(item.product?.weightPerPiece || 0);

            const requiredQty = isSelectedLine && order.requiredRawMaterialQty !== null && order.requiredRawMaterialQty !== undefined
              ? Number(order.requiredRawMaterialQty)
              : quantity * weightPerPiece;

            const fallbackRm = activeRawMaterials[0];
            const availableStock = fallbackRm ? Number(fallbackRm.onHandQty) : 0;
            if (fallbackRm) {
              requiredRms = [{
                rawMaterialId: fallbackRm.rawMaterialId,
                materialName: fallbackRm.materialName,
                requiredQty,
                availableStock,
                status: availableStock >= requiredQty ? "AVAILABLE" : "INSUFFICIENT"
              }];
            }
          }

          const isSelectedLine = productId.toString() === order.productItemId.toString();
          const weightUsed = isSelectedLine && order.weightPerPieceUsed !== null && order.weightPerPieceUsed !== undefined
            ? Number(order.weightPerPieceUsed)
            : Number(item.product?.weightPerPiece || 0);

          let finalRms: any[] = [];
          if (order.draftRawMaterials) {
            finalRms = (order.draftRawMaterials as any[]).map(rm => {
              const currentRm = rmMap.get(rm.rawMaterialId);
              const availableStock = currentRm ? Number(currentRm.onHandQty) : 0;
              const reqQty = Number(rm.requiredQty);
              return {
                ...rm,
                materialName: currentRm?.materialName || rm.rawMaterialId,
                availableStock,
                status: availableStock >= reqQty ? "AVAILABLE" : "INSUFFICIENT"
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
            uom: item.product?.uom?.uomCode || item.product?.uom?.uomName || 'PCS',
            weightPerPieceUsed: weightUsed,
            rawMaterials: finalRms
          };
        }));
      }
    }

    if (products.length === 0) {
      const productId = order.productItemId;
      const quantity = Number(order.targetQty);
      
      let bomItems: any[] = [];
      try {
        // @ts-ignore
        bomItems = await (prisma as any).billOfMaterial.findMany({
          where: { productId },
          include: { rawMaterial: true }
        });
      } catch (e) {
        bomItems = [];
      }

      let requiredRms: any[] = [];
      if (bomItems && bomItems.length > 0) {
        requiredRms = bomItems.map(bi => {
          const currentRm = rmMap.get(bi.rawMaterialId) || bi.rawMaterial;
          const requiredQty = Number(bi.requiredQuantity) * quantity;
          const availableStock = currentRm ? Number(currentRm.onHandQty) : 0;
          return {
            rawMaterialId: bi.rawMaterialId,
            materialName: currentRm?.materialName || bi.rawMaterial?.materialName || bi.rawMaterialId,
            requiredQty,
            availableStock,
            status: availableStock >= requiredQty ? "AVAILABLE" : "INSUFFICIENT"
          };
        });
      } else {
        const weightPerPiece = order.weightPerPieceUsed !== null && order.weightPerPieceUsed !== undefined
          ? Number(order.weightPerPieceUsed)
          : Number(order.productItem?.weightPerPiece || 0);
        const requiredQty = order.requiredRawMaterialQty !== null && order.requiredRawMaterialQty !== undefined
          ? Number(order.requiredRawMaterialQty)
          : quantity * weightPerPiece;
        const fallbackRm = activeRawMaterials[0];
        const availableStock = fallbackRm ? Number(fallbackRm.onHandQty) : 0;
        if (fallbackRm) {
          requiredRms = [{
            rawMaterialId: fallbackRm.rawMaterialId,
            materialName: fallbackRm.materialName,
            requiredQty,
            availableStock,
            status: availableStock >= requiredQty ? "AVAILABLE" : "INSUFFICIENT"
          }];
        }
      }

      products = [{
        productId: productId.toString(),
        productCode: order.productItem?.productCode,
        productName: order.productItem?.productName,
        quantity,
        uom: order.uom,
        weightPerPieceUsed: order.weightPerPieceUsed !== null && order.weightPerPieceUsed !== undefined ? Number(order.weightPerPieceUsed) : Number(order.productItem?.weightPerPiece || 0),
        rawMaterials: order.draftRawMaterials && Array.isArray(order.draftRawMaterials) && order.draftRawMaterials.length > 0 
          ? (order.draftRawMaterials as any[]) 
          : requiredRms
      }];
    }

    return {
        ...order,
        productItemId: order.productItemId.toString(),
        sourceSalesOrderLineId: order.sourceSalesOrderLineId?.toString(),
        products,
    };
  }

  async update(productionOrderId: string, data: UpdateProductionOrderInput, userId?: string) {
    const existing = await this.findById(productionOrderId);

    // NEW REQUIREMENT: Lock Production Order from manual edits once scheduled
    const nonEditableStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"];
    
    if (nonEditableStatuses.includes(existing.status || "")) {
      const keys = Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined);
      const allowedExecutionKeys = ["status", "producedQty", "rejectedQty", "scrapQty"];
      const isSystemStatusUpdate = keys.every(k => allowedExecutionKeys.includes(k));
      
      if (!isSystemStatusUpdate) {
        throw new ApiError(400, "Production Order has already been scheduled and cannot be modified.");
      }
    }

    const updateData: any = {};

    if (!nonEditableStatuses.includes(existing.status || "")) {
      // Validate and parse all fields if they are defined
      if (data.orderDate !== undefined) updateData.orderDate = new Date(data.orderDate);
      if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
      
      if (data.productItemId !== undefined) {
        const productItemId = BigInt(data.productItemId);
        const product = await prisma.product.findUnique({ where: { id: productItemId } });
        if (!product) {
          throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
        }
        updateData.productItemId = productItemId;
      }

      if (data.targetQty !== undefined) updateData.targetQty = data.targetQty;
      if (data.producedQty !== undefined) updateData.producedQty = data.producedQty;
      if (data.rejectedQty !== undefined) updateData.rejectedQty = data.rejectedQty;
      if (data.scrapQty !== undefined) updateData.scrapQty = data.scrapQty;
      if (data.uom !== undefined) updateData.uom = data.uom;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.orderType !== undefined) updateData.orderType = data.orderType;
      if (data.batchNo !== undefined) updateData.batchNo = data.batchNo;
      if (data.lotNo !== undefined) updateData.lotNo = data.lotNo;

      if (data.sourceSalesOrderId !== undefined) {
        if (data.sourceSalesOrderId && data.sourceSalesOrderId !== existing.sourceSalesOrderId) {
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
              NOT: { productionOrderId }
            }
          });
          if (existingPoForSo) {
            throw new ApiError(400, "A Production Order has already been created for this Production Approval.");
          }
        }
        updateData.sourceSalesOrderId = data.sourceSalesOrderId;
      }

      if (data.sourceSalesOrderLineId !== undefined) {
        updateData.sourceSalesOrderLineId = data.sourceSalesOrderLineId ? BigInt(data.sourceSalesOrderLineId) : null;
      }


      if (data.sourceStoreId !== undefined) {
        if (data.sourceStoreId) {
          const store = await prisma.store.findUnique({ where: { storeId: data.sourceStoreId } });
          if (!store) {
            throw new ApiError(404, `Source Store with ID ${data.sourceStoreId} not found`);
          }
        }
        updateData.sourceStoreId = data.sourceStoreId;
      }

      if (data.destinationStoreId !== undefined) {
        if (data.destinationStoreId) {
          const store = await prisma.store.findUnique({ where: { storeId: data.destinationStoreId } });
          if (!store) {
            throw new ApiError(404, `Destination Store with ID ${data.destinationStoreId} not found`);
          }
        }
        updateData.destinationStoreId = data.destinationStoreId;
      }

      if (data.billOfMaterialId !== undefined) {
        if (data.billOfMaterialId) {
          const bom = await (prisma as any).billOfMaterial.findFirst({
            where: { id: Number(data.billOfMaterialId) }
          });
          if (!bom) {
            throw new ApiError(404, `Bill Of Material with ID ${data.billOfMaterialId} not found`);
          }
        }
        updateData.billOfMaterialId = data.billOfMaterialId ? String(data.billOfMaterialId) : null;
      }

      if (data.routingId !== undefined) updateData.routingId = data.routingId;

      if (data.machineMachineId !== undefined) {
        if (data.machineMachineId) {
          const machine = await prisma.machine.findUnique({ where: { machineId: data.machineMachineId } });
          if (!machine) {
            throw new ApiError(404, `Machine with ID ${data.machineMachineId} not found`);
          }
        }
        updateData.machineMachineId = data.machineMachineId;
      }

      if (data.remarks !== undefined) updateData.remarks = data.remarks;
      if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
      if (data.approvedAt !== undefined) updateData.approvedAt = data.approvedAt ? new Date(data.approvedAt) : null;

      // Recalculate weightPerPieceUsed and requiredRawMaterialQty on update
      const finalProductItemId = updateData.productItemId ?? existing.productItemId;
      const finalTargetQty = updateData.targetQty !== undefined ? Number(updateData.targetQty) : Number(existing.targetQty);
      
      const product = await prisma.product.findUnique({ where: { id: finalProductItemId } });
      if (product) {
        updateData.weightPerPieceUsed = product.weightPerPiece ? Number(product.weightPerPiece) : 0;
        updateData.requiredRawMaterialQty = finalTargetQty * updateData.weightPerPieceUsed;
      }
      if (data.rawMaterials) {
        updateData.draftRawMaterials = data.rawMaterials as any;
      }
    } else {
      if (data.producedQty !== undefined) updateData.producedQty = data.producedQty;
      if (data.rejectedQty !== undefined) updateData.rejectedQty = data.rejectedQty;
      if (data.scrapQty !== undefined) updateData.scrapQty = data.scrapQty;
    }

    let calculatedStatus = data.status ?? existing.status;
    let rmMoves: { type: "RESERVE" | "RELEASE" | "CONSUME" | "CONSUME_UNRESERVED"; rawMaterialId: string; qty: number }[] = [];

    // Draft -> Confirmed
    if (existing.status === "DRAFT" && data.status && data.status !== "DRAFT") {
      const rawMaterialsToUse = data.rawMaterials ?? [];
      if (rawMaterialsToUse.length > 0) {
        const rmCheck = await this.checkRawMaterialAvailability(rawMaterialsToUse);
        calculatedStatus = rmCheck.allAvailable ? "RM_AVAILABLE" : "RM_PENDING";
        
        if (rmCheck.allAvailable) {
          for (const move of rmCheck.rmMoves) {
            rmMoves.push({ type: "RESERVE", rawMaterialId: move.rawMaterialId, qty: move.qty });
          }
        }
      } else {
        calculatedStatus = "PLANNED";
      }
    }

    // RM_PENDING or DRAFT -> PLANNED (recheck raw material availability)
    if ((existing.status === "RM_PENDING" || existing.status === "DRAFT") && data.status === "PLANNED") {
      const rawMaterialsToUse = data.rawMaterials ?? (existing.draftRawMaterials as any[]) ?? [];
      if (rawMaterialsToUse.length > 0) {
        const rmCheck = await this.checkRawMaterialAvailability(rawMaterialsToUse);
        calculatedStatus = rmCheck.allAvailable ? "RM_AVAILABLE" : "RM_PENDING";

        if (rmCheck.allAvailable) {
          for (const move of rmCheck.rmMoves) {
            rmMoves.push({ type: "RESERVE", rawMaterialId: move.rawMaterialId, qty: move.qty });
          }
        }
      } else {
        calculatedStatus = "PLANNED";
      }
    }

    // Confirmed / IN_PROGRESS -> CANCELLED (Release stock)
    if ((existing.status === "RM_AVAILABLE" || existing.status === "IN_PROGRESS" || existing.status === "IN PROGRESS") && calculatedStatus === "CANCELLED") {
      const rawMaterialsToUse = (existing.draftRawMaterials as any[]) || [];
      for (const rm of rawMaterialsToUse) {
        rmMoves.push({ type: "RELEASE", rawMaterialId: rm.rawMaterialId, qty: Number(rm.requiredQty) });
      }
    }

    // *** PRODUCTION START GATING: MATERIAL_ISSUED or IN_PROGRESS status requires a completed Material Issue ***
    if (
      calculatedStatus === "IN_PROGRESS" &&
      existing.status !== "IN_PROGRESS" &&
      existing.status !== "IN PROGRESS"
    ) {
      const materialIssueAdj = await prisma.stockAdjustment.findFirst({
        where: {
          productionOrderId,
          adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
          status: "APPROVED",
        },
      });

      if (!materialIssueAdj) {
        throw new ApiError(
          400,
          "Production cannot be started because the required raw materials have not yet been issued. Please complete the Material Issue through Stock Adjustment before starting production."
        );
      }
    }


    let shouldProduceFG = false;
    if (existing.status !== "COMPLETED" && calculatedStatus === "COMPLETED") {
      const rawMaterialsToUse = (existing.draftRawMaterials as any[]) || [];
      const wasReserved = existing.status === "RM_AVAILABLE" || existing.status === "IN_PROGRESS" || existing.status === "IN PROGRESS";

      for (const rm of rawMaterialsToUse) {
        rmMoves.push({
          type: wasReserved ? "CONSUME" : "CONSUME_UNRESERVED",
          rawMaterialId: rm.rawMaterialId,
          qty: Number(rm.requiredQty),
        });
      }
      shouldProduceFG = true;
    }

    updateData.status = calculatedStatus;
    updateData.updatedBy = userId;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Check stock constraints for CONSUME / CONSUME_UNRESERVED moves
      for (const move of rmMoves) {
        if (move.type === "CONSUME" || move.type === "CONSUME_UNRESERVED") {
          const stock = await tx.rawMaterial.findUnique({
            where: { rawMaterialId: move.rawMaterialId },
            include: { store: true },
          });

          if (stock) {
            const newOnHand = Number(stock.onHandQty) - move.qty;
            const allowNegative = stock.store ? stock.store.allowNegative : false;
            if (newOnHand < 0 && !allowNegative) {
              throw new ApiError(400, `Insufficient stock for raw material ${stock.materialName} (${move.rawMaterialId}). Negative stock is not allowed in store ${stock.store?.storeName || ""}.`);
            }
          }
        }
      }

      // 2. Perform updates
      const resultOrder = await tx.productionOrder.update({
        where: { productionOrderId },
        data: updateData,
        include: { productItem: true },
      });

      // 3. Apply raw material moves
      for (const move of rmMoves) {
        if (move.type === "RESERVE") {
          await tx.rawMaterial.update({
            where: { rawMaterialId: move.rawMaterialId },
            data: { reservedQty: { increment: move.qty } },
          });
        } else if (move.type === "RELEASE") {
          await tx.rawMaterial.update({
            where: { rawMaterialId: move.rawMaterialId },
            data: { reservedQty: { decrement: move.qty } },
          });
        } else if (move.type === "CONSUME") {
          const stock = await tx.rawMaterial.findUnique({ where: { rawMaterialId: move.rawMaterialId } });
          let storeId = stock?.storeId || existing.sourceStoreId || existing.destinationStoreId;
          if (!storeId) {
            const firstStore = await tx.store.findFirst();
            storeId = firstStore?.storeId || "STORE-1";
          }

          await tx.rawMaterial.update({
            where: { rawMaterialId: move.rawMaterialId },
            data: {
              onHandQty: { decrement: move.qty },
              reservedQty: { decrement: move.qty },
            },
          });
          // Log transaction
          await tx.rawMaterialTransaction.create({
            data: {
              storeId: storeId,
              rawMaterialId: move.rawMaterialId,
              txnType: "PRODUCTION_CONSUMPTION",
              qty: -move.qty,
              remarks: `Consumed for production order ${productionOrderId}`,
            },
          });
        } else if (move.type === "CONSUME_UNRESERVED") {
          const stock = await tx.rawMaterial.findUnique({ where: { rawMaterialId: move.rawMaterialId } });
          let storeId = stock?.storeId || existing.sourceStoreId || existing.destinationStoreId;
          if (!storeId) {
            const firstStore = await tx.store.findFirst();
            storeId = firstStore?.storeId || "STORE-1";
          }

          await tx.rawMaterial.update({
            where: { rawMaterialId: move.rawMaterialId },
            data: {
              onHandQty: { decrement: move.qty },
            },
          });
          // Log transaction
          await tx.rawMaterialTransaction.create({
            data: {
              storeId: storeId,
              rawMaterialId: move.rawMaterialId,
              txnType: "PRODUCTION_CONSUMPTION",
              qty: -move.qty,
              remarks: `Consumed for production order ${productionOrderId} (unreserved)`,
            },
          });
        }
      }

      // 4. Update Finished Goods Inventory on completion
      if (shouldProduceFG) {
        let storeId = existing.destinationStoreId || existing.sourceStoreId;
        if (!storeId) {
          const firstStore = await tx.store.findFirst();
          storeId = firstStore?.storeId || "STORE-1";
        }
        const productItemId = existing.productItemId;
        const qtyProduced = Number(updateData.producedQty ?? existing.producedQty) || Number(existing.targetQty);

        // Find or create FinishedGoodsStock
        const fgStock = await tx.finishedGoodsStock.findUnique({
          where: {
            storeId_productItemId: {
              storeId,
              productItemId,
            },
          },
        });

        if (fgStock) {
          await tx.finishedGoodsStock.update({
            where: {
              storeId_productItemId: {
                storeId,
                productItemId,
              },
            },
            data: {
              onHandQty: { increment: qtyProduced },
            },
          });
        } else {
          await tx.finishedGoodsStock.create({
            data: {
              storeId,
              productItemId,
              onHandQty: qtyProduced,
            },
          });
        }

        // Create FinishedGoodsTransaction
        await tx.finishedGoodsTransaction.create({
          data: {
            txnDateTime: new Date(),
            storeId,
            productItemId,
            txnType: "PRODUCTION_RECEIPT",
            qty: qtyProduced,
            productionOrderId: productionOrderId,
            remarks: `Received from production order ${productionOrderId}`,
            createdBy: userId,
          },
        });
      }

      // Check if sales order reference changed or status changed to update productionStatus
      const sourceSalesOrderIdChanged = data.sourceSalesOrderId !== undefined && data.sourceSalesOrderId !== existing.sourceSalesOrderId;
      const statusChanged = calculatedStatus !== existing.status;

      if (sourceSalesOrderIdChanged || statusChanged) {
        // 1. Reset old Sales Order status if it changed
        if (sourceSalesOrderIdChanged && existing.sourceSalesOrderId) {
          let oldSalesOrderId = null;
          if (!isNaN(Number(existing.sourceSalesOrderId))) {
            oldSalesOrderId = Number(existing.sourceSalesOrderId);
          } else {
            const so = await tx.salesOrder.findUnique({ where: { orderNo: existing.sourceSalesOrderId } });
            if (so) oldSalesOrderId = so.id;
          }
          if (oldSalesOrderId) {
            await tx.salesOrder.update({
              where: { id: oldSalesOrderId },
              data: { productionStatus: "NOT_STARTED" }
            });
          }
        }

        // 2. Update new/current Sales Order status
        const currentSalesOrderIdVal = data.sourceSalesOrderId !== undefined ? data.sourceSalesOrderId : existing.sourceSalesOrderId;
        if (currentSalesOrderIdVal) {
          let currentSalesOrderId = null;
          if (!isNaN(Number(currentSalesOrderIdVal))) {
            currentSalesOrderId = Number(currentSalesOrderIdVal);
          } else {
            const so = await tx.salesOrder.findUnique({ where: { orderNo: currentSalesOrderIdVal } });
            if (so) currentSalesOrderId = so.id;
          }
          if (currentSalesOrderId) {
            await tx.salesOrder.update({
              where: { id: currentSalesOrderId },
              data: { productionStatus: calculatedStatus === "DRAFT" ? "PRODUCTION_DRAFT" : "PRODUCTION_CREATED" }
            });
          }
        }
      }

      return resultOrder;
    });

    return updatedOrder;
  }

  async delete(productionOrderId: string) {
    const existing = await this.findById(productionOrderId);

    if (["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(existing.status)) {
      throw new ApiError(400, `Production Order is already ${existing.status.toLowerCase()} and cannot be deleted.`);
    }

    if (existing.sourceSalesOrderId) {
      throw new ApiError(400, "Production Orders generated from Sales Orders cannot be deleted directly.");
    }
    
    await prisma.productionOrder.update({
      where: { productionOrderId },
      data: { status: "CANCELLED" }
    });

    if (existing.sourceSalesOrderId) {
      let soId = null;
      if (!isNaN(Number(existing.sourceSalesOrderId))) {
        soId = Number(existing.sourceSalesOrderId);
      } else {
        const so = await prisma.salesOrder.findUnique({ where: { orderNo: existing.sourceSalesOrderId } });
        if (so) soId = so.id;
      }
      
      if (soId) {
        await prisma.salesOrder.update({
          where: { id: soId },
          data: { productionStatus: "NOT_STARTED" }
        });
      }
    }

    return { message: "Production order deleted successfully" };
  }

  async getNextProductionOrderId() {
    const lastItem = await prisma.productionOrder.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastItem) {
      return "PO0001";
    }

    // e.g. "PO0001-2" -> strip everything from the dash onwards
    let lastId = lastItem.productionOrderId;
    if (lastId.includes('-')) {
        lastId = lastId.split('-')[0];
    }

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

  /**
   * Helper to check raw material availability and generate reservation moves
   */
  private async checkRawMaterialAvailability(rawMaterials: any[]) {
    let allAvailable = true;
    const aggregatedRms: Record<string, number> = {};
    const rmMoves: { rawMaterialId: string; qty: number }[] = [];

    for (const rm of rawMaterials) {
      aggregatedRms[rm.rawMaterialId] = (aggregatedRms[rm.rawMaterialId] || 0) + Number(rm.requiredQty);
    }

    for (const [rawMaterialId, totalRequired] of Object.entries(aggregatedRms)) {
      const stock = await prisma.rawMaterial.findUnique({
        where: { rawMaterialId }
      });
      
      const availableStock = stock ? Number(stock.onHandQty) - Number(stock.reservedQty) : 0;
      if (!stock || availableStock < totalRequired) {
        allAvailable = false;
        break;
      }
    }

    if (allAvailable) {
      for (const [rawMaterialId, totalRequired] of Object.entries(aggregatedRms)) {
        rmMoves.push({ rawMaterialId, qty: totalRequired });
      }
    }

    return { allAvailable, rmMoves };
  }

  async issueMaterials(productionOrderId: string, data: { items: { rawMaterialId: string; storeId: string; qty: number; remarks?: string }[] }, userId?: string) {
    const { items } = data;

    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
    });
    if (!order) {
      throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);
    }

    return prisma.$transaction(async (tx) => {
      const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const adjustmentNumber = `ADJ-PO-${productionOrderId}-${dateStr}`;

      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: new Date(),
          adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
          productionOrderId,
          reason: `Material issued for Production Order: ${productionOrderId}`,
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: new Date(),
          createdBy: userId,
        },
      });

      for (const item of items) {
        const { rawMaterialId, storeId, qty, remarks } = item;

        const rm = await tx.rawMaterial.findUnique({
          where: { rawMaterialId },
        });
        if (!rm) {
          throw new ApiError(404, `Raw Material with ID ${rawMaterialId} not found`);
        }

        const currentQty = rm.onHandQty;
        const newOnHand = Number(rm.onHandQty) - qty;
        const newReserved = Math.max(0, Number(rm.reservedQty) - qty);

        await tx.rawMaterial.update({
          where: { rawMaterialId },
          data: {
            onHandQty: newOnHand,
            reservedQty: newReserved,
            updatedBy: userId,
          },
        });

        await tx.rawMaterialTransaction.create({
          data: {
            storeId,
            rawMaterialId,
            txnType: "MATERIAL_ISSUE",
            qty,
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

      const updatedOrder = await tx.productionOrder.update({
        where: { productionOrderId },
        data: {
          status: "MATERIAL_ISSUED",
          updatedBy: userId,
        },
      });

      return updatedOrder;
    });
  }
}

export default new ProductionOrderService();
