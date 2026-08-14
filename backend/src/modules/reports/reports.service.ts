import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

class ReportsService {
  /**
   * Machine status and efficiency report.
   */
  async getMachineReport(startDate?: string, endDate?: string) {
    const machines = await prisma.machine.findMany({
      orderBy: { machineId: "asc" },
      include: {
        productionOrders: {
          where: {
            status: "IN_PROGRESS",
          },
          include: {
            productItem: true,
          },
        },
      },
    });

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const report = [];

    for (const machine of machines) {
      // Find all weekly programs for this machine within range
      const weeklyPrograms = await prisma.weeklyMachineProgram.findMany({
        where: {
          machineId: machine.machineId,
          ...(start && end
            ? {
                weekStartDate: {
                  gte: start,
                  lte: end,
                },
              }
            : {}),
        },
      });

      // Find all production orders for this machine within range
      const productionOrders = await prisma.productionOrder.findMany({
        where: {
          machineMachineId: machine.machineId,
          ...(start && end
            ? {
                orderDate: {
                  gte: start,
                  lte: end,
                },
              }
            : {}),
        },
        include: {
          hourlyProductions: true,
        },
      });

      const totalWeeklyPlannedQty = weeklyPrograms.reduce(
        (sum, wp) => sum + Number(wp.plannedQty),
        0
      );

      const totalActualQty = productionOrders.reduce((sum, po) => {
        const orderSum = po.hourlyProductions.reduce(
          (hSum, hp) => hSum + Number(hp.qtyProduced),
          0
        );
        return sum + orderSum;
      }, 0);

      const totalTargetQty = productionOrders.reduce(
        (sum, po) => sum + Number(po.targetQty),
        0
      );

      // Determine machine status
      let status = "IDLE";
      if (!machine.isActive) {
        status = "INACTIVE";
      } else if (machine.productionOrders.length > 0) {
        status = "RUNNING";
      }

      const activeProductionOrder = machine.productionOrders[0]
        ? {
            productionOrderId: machine.productionOrders[0].productionOrderId,
            productCode: machine.productionOrders[0].productItem.productCode,
            productName: machine.productionOrders[0].productItem.productName,
            targetQty: Number(machine.productionOrders[0].targetQty),
            status: machine.productionOrders[0].status,
          }
        : null;

      report.push({
        machineId: machine.machineId,
        machineName: machine.machineName,
        machineType: machine.machineType,
        description: machine.description,
        isActive: machine.isActive,
        status,
        activeProductionOrder,
        metrics: {
          totalWeeklyPlannedQty,
          totalTargetQty,
          totalActualQty,
          efficiencyPercentage:
            totalWeeklyPlannedQty > 0
              ? parseFloat(((totalActualQty / totalWeeklyPlannedQty) * 100).toFixed(2))
              : 0,
        },
      });
    }

    return report;
  }

  /**
   * Weekly Program Progress Report.
   */
  async getWeeklyProgramReport(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const weeklyPrograms = await prisma.weeklyMachineProgram.findMany({
      where: start && end ? {
        weekStartDate: {
          gte: start,
          lte: end,
        }
      } : undefined,
      orderBy: { weekStartDate: "desc" },
      include: {
        machine: true,
        Product: true,
        productionOrder: {
          include: {
            hourlyProductions: true,
          },
        },
      },
    });

    return weeklyPrograms.map((wp) => {
      const totalActualQty = wp.productionOrder ? wp.productionOrder.hourlyProductions.reduce((sum: number, hp: any) => {
        return sum + Number(hp.qtyProduced);
      }, 0) : 0;

      const plannedQty = Number(wp.plannedQty);

      return {
        weeklyProgramId: wp.weeklyProgramId,
        weekStartDate: wp.weekStartDate,
        weekEndDate: wp.weekEndDate,
        machineId: wp.machineId,
        machineName: wp.machine?.machineName || "Unassigned",
        plannedProductItemId: wp.productId ? wp.productId.toString() : null,
        productCode: wp.Product?.productCode || null,
        productName: wp.Product?.productName || null,
        plannedQty,
        totalActualQty,
        progressPercentage:
          plannedQty > 0
            ? parseFloat(((totalActualQty / plannedQty) * 100).toFixed(2))
            : 0,
        productionOrdersCount: wp.productionOrder ? 1 : 0,
        status: wp.status,
        remarks: wp.remarks,
      };
    });
  }

  /**
   * Production Order detailed report with hourly breakdown.
   */
  async getProductionOrderReport(productionOrderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        Machine: true,
        productItem: true,
        hourlyProductions: {
          orderBy: { hourIndex: "asc" },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, `Production Order with ID ${productionOrderId} not found`);
    }

    const totalQtyProduced = order.hourlyProductions.reduce(
      (sum, hp) => sum + Number(hp.qtyProduced),
      0
    );

    const targetQty = Number(order.targetQty);

    const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => {
      const hour = i + 1;
      const log = order.hourlyProductions.find((h) => h.hourIndex === hour);
      return {
        hourIndex: hour,
        qtyProduced: log ? Number(log.qtyProduced) : 0,
        loggedAt: log ? log.createdAt : null,
        updatedAt: log ? log.updatedAt : null,
      };
    });

    return {
      productionOrderId: order.productionOrderId,
      orderDate: order.orderDate,
      machineId: order.machineMachineId,
      machineName: order.Machine?.machineName || "N/A",
      productItemId: order.productItemId.toString(),
      productCode: order.productItem.productCode,
      productName: order.productItem.productName,
      targetQty,
      uom: order.uom,
      weeklyProgramId: null,
      sourceSalesOrderId: order.sourceSalesOrderId,
      sourceSalesOrderLineId: order.sourceSalesOrderLineId ? order.sourceSalesOrderLineId.toString() : null,
      status: order.status,
      remarks: order.remarks,
      totalQtyProduced,
      remainingQty: Math.max(0, targetQty - totalQtyProduced),
      progressPercentage:
        targetQty > 0
          ? parseFloat(((totalQtyProduced / targetQty) * 100).toFixed(2))
          : 0,
      hourlyBreakdown,
    };
  }
  /**
   * Sales Order Report.
   */
  async getSalesOrderReport(
    startDate?: string,
    endDate?: string,
    orderNo?: string,
    customerId?: string,
    status?: string,
    mdApprovalStatus?: string,
    customerApprovalStatus?: string,
    salesPersonName?: string,
    dispatchType?: string,
    orderType?: string,
    productionStatus?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const whereClause: any = {};

    if (start || end) {
      whereClause.orderDate = {};
      if (start) whereClause.orderDate.gte = start;
      if (end) whereClause.orderDate.lte = end;
    }

    if (orderNo) whereClause.orderNo = { contains: orderNo, mode: 'insensitive' };
    if (customerId) whereClause.customerId = customerId;
    if (status) whereClause.status = status;
    if (mdApprovalStatus) whereClause.mdApprovalStatus = mdApprovalStatus;
    if (customerApprovalStatus) whereClause.customerApprovalStatus = customerApprovalStatus;
    if (salesPersonName) whereClause.salesPersonName = { contains: salesPersonName, mode: 'insensitive' };
    if (dispatchType) whereClause.dispatchType = { contains: dispatchType, mode: 'insensitive' };
    if (orderType) whereClause.orderType = { contains: orderType, mode: 'insensitive' };
    if (productionStatus) whereClause.productionStatus = productionStatus;

    const skip = (page - 1) * limit;

    const [total, salesOrders] = await Promise.all([
      prisma.salesOrder.count({ where: whereClause }),
      prisma.salesOrder.findMany({
        where: whereClause,
        orderBy: { orderDate: "desc" },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              displayName: true,
              firmName: true,
              customerCode: true,
            }
          },
          items: {
            include: {
              product: {
                select: { productName: true, productCode: true }
              }
            }
          },
        },
      })
    ]);

    const mappedData = salesOrders.map((so) => {
      return {
        id: so.id,
        orderNo: so.orderNo,
        orderDate: so.orderDate,
        customerName: so.customer?.displayName || so.customer?.firmName || "Unknown",
        customerCode: so.customer?.customerCode || "Unknown",
        itemsCount: so.items.length,
        netAmount: Number(so.netAmount),
        status: so.status,
        dispatchType: so.dispatchType,
        mdApprovalStatus: so.mdApprovalStatus,
        customerApprovalStatus: so.customerApprovalStatus,
        totalQty: so.items.reduce((sum, item) => sum + Number(item.quantity), 0),
        billingAddress: `${so.billingAddressLine1 || ''} ${so.billingCity || ''} ${so.billingState || ''} ${so.billingPincode || ''}`.trim(),
        shippingAddress: `${so.shippingAddressLine1 || ''} ${so.shippingCity || ''} ${so.shippingState || ''} ${so.shippingPincode || ''}`.trim(),
        totalDiscount: Number(so.totalDiscount || 0),
        orderDiscountType: so.orderDiscountType,
        orderDiscountValue: Number(so.orderDiscountValue || 0),
        totalCgst: Number(so.totalCgst || 0),
        totalSgst: Number(so.totalSgst || 0),
        totalIgst: Number(so.totalIgst || 0),
        items: so.items.map((item: any) => ({
          productName: item.product?.productName || 'Unknown',
          quantity: Number(item.quantity || 0),
          uom: item.product?.uomId || ''
        }))
      };
    });

    return {
      data: mappedData,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getPurchaseOrderReport(
    startDate?: string,
    endDate?: string,
    poNumber?: string,
    supplierId?: number,
    status?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const whereClause: any = {};

    if (start || end) {
      whereClause.poDate = {};
      if (start) whereClause.poDate.gte = start;
      if (end) whereClause.poDate.lte = end;
    }

    if (poNumber) whereClause.poNumber = { contains: poNumber, mode: 'insensitive' };
    if (supplierId) whereClause.supplierId = supplierId;
    if (status) whereClause.status = status;

    const skip = (page - 1) * limit;

    const [total, purchaseOrders] = await Promise.all([
      prisma.purchaseOrder.count({ where: whereClause }),
      prisma.purchaseOrder.findMany({
        where: whereClause,
        orderBy: { poDate: "desc" },
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              displayName: true,
              legalName: true,
              supplierCode: true,
            }
          },
          items: true,
        },
      })
    ]);

    const mappedData = purchaseOrders.map((po) => {
      return {
        id: po.id,
        poNumber: po.poNumber,
        poDate: po.poDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        supplierName: po.supplier?.displayName || po.supplier?.legalName || "Unknown",
        supplierCode: po.supplier?.supplierCode || "Unknown",
        billingAddress: `${po.billingAddressLine1 || ''} ${po.billingCity || ''} ${po.billingState || ''} ${po.billingPincode || ''}`.trim(),
        shippingAddress: `${po.shippingAddressLine1 || ''} ${po.shippingCity || ''} ${po.shippingState || ''} ${po.shippingPincode || ''}`.trim(),
        itemsCount: po.items.length,
        items: po.items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          uom: item.uom || ''
        })),
        totalDiscount: Number(po.totalDiscount || 0),
        totalTax: Number(po.totalTax || 0),
        totalCgst: Number(po.totalCgst || 0),
        totalSgst: Number(po.totalSgst || 0),
        totalIgst: Number(po.totalIgst || 0),
        netAmount: Number(po.netAmount),
        status: po.status,
      };
    });

    return {
      data: mappedData,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

export default new ReportsService();
