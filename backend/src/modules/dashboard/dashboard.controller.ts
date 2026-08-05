import { Request, Response } from "express";
import { prisma } from "../../config/prisma";

const dashboardController = {
  getSummary: async (req: Request, res: Response) => {
    try {
      const [
        salesOrders,
        purchaseOrders,
        productionOrders,
        productsCount,
        employeesCount,
        machines,
        weeklyPrograms,
        rawMaterials,
        finishedGoodsStocks,
        dailyPlans,
        salesInvoices,
      ] = await Promise.all([
        // Sales Orders
        prisma.salesOrder.findMany({
          select: {
            id: true,
            orderNo: true,
            netAmount: true,
            status: true,
            createdAt: true,
            orderDate: true,
            customer: { select: { id: true, firmName: true } }
          },
          orderBy: { createdAt: "desc" },
        }).catch(() => []),

        // Purchase Orders
        prisma.purchaseOrder.findMany({
          select: {
            id: true,
            poNumber: true,
            netAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }).catch(() => []),

        // Production Orders
        prisma.productionOrder.findMany({
          select: {
            productionOrderId: true,
            status: true,
            targetQty: true,
            producedQty: true,
            createdAt: true,
            orderDate: true,
            productItem: { select: { productName: true } },
          },
          orderBy: { createdAt: "desc" },
        }).catch(() => []),

        // Products count
        prisma.product.count().catch(() => 0),

        // Active employees count
        prisma.employee.count({ where: { status: "active" } }).catch(() => 0),

        // Machines
        prisma.machine.findMany({
          take: 10,
        }).catch(() => []),

        // Weekly Programs
        prisma.weeklyMachineProgram.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        }).catch(() => []),

        // Raw Materials
        prisma.rawMaterial.findMany({
          select: {
            rawMaterialId: true,
            materialName: true,
            baseUom: true,
            onHandQty: true,
            storeId: true,
            store: { select: { storeName: true } },
          }
        }).catch(() => []),

        // Finished Goods Stocks
        prisma.finishedGoodsStock.findMany({
          select: {
            onHandQty: true,
            productItemId: true,
            storeId: true,
            product: { select: { productName: true } },
            store: { select: { storeName: true } }
          }
        }).catch(() => []),

        // Daily Plans
        prisma.dailyProductionPlan.findMany({
          select: {
            dailyPlanId: true,
            productionDate: true,
            status: true,
            productionOrderId: true,
            machine: { select: { machineName: true } },
            shift: { select: { shiftName: true } },
            productionOrder: {
              select: {
                productItem: { select: { productName: true } }
              }
            }
          },
          orderBy: { productionDate: "desc" },
          take: 50,
        }).catch(() => []),

        // Sales Invoices for pending amount
        prisma.salesInvoice.findMany({
          select: {
            id: true,
            grandTotal: true,
            payments: true,
            status: true,
          },
          where: {
            status: { not: "CANCELLED" },
          },
        }).catch(() => []),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          salesOrders,
          purchaseOrders,
          productionOrders,
          productsCount,
          employeesCount,
          machines,
          weeklyPrograms,
          rawMaterials,
          rawMaterialStocks: [],
          finishedGoodsStocks,
          dailyPlans,
          salesInvoices,
        },
      });
    } catch (error) {
      console.error("Dashboard summary error:", error);
      return res.status(500).json({ success: false, message: "Failed to load dashboard data" });
    }
  },
};

export default dashboardController;
