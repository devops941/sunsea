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
        machineName: wp.machine.machineName,
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
}

export default new ReportsService();
