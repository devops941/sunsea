import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType } from "@prisma/client";

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

  getAccountsSummary: async (req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Bank & Cash accounts with balances
      const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand", "BANK ACCOUNTS", "CASH IN HAND"];
      const bankLedgers = await prisma.accountLedger.findMany({
        where: { type: LedgerType.ASSET, group: { in: bankGroups, mode: "insensitive" }, isActive: true },
      });

      let totalBankBalance = 0;
      let totalCashInHand = 0;
      for (const ledger of bankLedgers) {
        const debit = await prisma.journalItem.aggregate({ _sum: { debitAmount: true }, where: { debitLedgerId: ledger.id } });
        const credit = await prisma.journalItem.aggregate({ _sum: { creditAmount: true }, where: { creditLedgerId: ledger.id } });
        const balance = Number(debit._sum.debitAmount || 0) - Number(credit._sum.creditAmount || 0);
        if (ledger.group.toLowerCase().includes("cash")) {
          totalCashInHand += balance;
        } else {
          totalBankBalance += balance;
        }
      }

      // Total Receivable (customers owe us)
      const customerLedgers = await prisma.accountLedger.findMany({
        where: { customerId: { not: null } },
        include: { customer: { select: { openingBalance: true } } },
      });
      let totalReceivable = 0;
      for (const cl of customerLedgers) {
        const opBal = Number((cl.customer as any)?.openingBalance || 0);
        const dr = await prisma.journalItem.aggregate({
          _sum: { debitAmount: true },
          where: { debitLedgerId: cl.id, voucher: { refDocType: { notIn: ["CUSTOMER_OPENING_BALANCE"] } } },
        });
        const cr = await prisma.journalItem.aggregate({
          _sum: { creditAmount: true },
          where: { creditLedgerId: cl.id, voucher: { refDocType: { notIn: ["CUSTOMER_OPENING_BALANCE"] } } },
        });
        totalReceivable += opBal + Number(dr._sum.debitAmount || 0) - Number(cr._sum.creditAmount || 0);
      }

      // Total Payable (we owe suppliers)
      const supplierLedgers = await prisma.accountLedger.findMany({
        where: { supplierId: { not: null } },
        include: { supplier: { select: { openingBalance: true } } },
      });
      let totalPayable = 0;
      for (const sl of supplierLedgers) {
        const opBal = Number((sl.supplier as any)?.openingBalance || 0);
        const dr = await prisma.journalItem.aggregate({
          _sum: { debitAmount: true },
          where: { debitLedgerId: sl.id, voucher: { refDocType: { notIn: ["SUPPLIER_OPENING_BALANCE"] } } },
        });
        const cr = await prisma.journalItem.aggregate({
          _sum: { creditAmount: true },
          where: { creditLedgerId: sl.id, voucher: { refDocType: { notIn: ["SUPPLIER_OPENING_BALANCE"] } } },
        });
        totalPayable += opBal + Number(cr._sum.creditAmount || 0) - Number(dr._sum.debitAmount || 0);
      }

      // Today's receipts and payments
      const todayVouchers = await prisma.voucher.findMany({
        where: { date: { gte: today, lt: tomorrow } },
        include: { items: true },
      });

      let todayReceipts = 0;
      let todayPayments = 0;
      let todayReceiptCount = 0;
      let todayPaymentCount = 0;
      for (const v of todayVouchers) {
        if (v.type === VoucherType.RECEIPT) {
          todayReceipts += v.items.reduce((s, i) => s + Number(i.debitAmount || 0), 0);
          todayReceiptCount++;
        } else if (v.type === VoucherType.PAYMENT) {
          todayPayments += v.items.reduce((s, i) => s + Number(i.debitAmount || 0), 0);
          todayPaymentCount++;
        }
      }

      return res.json({
        success: true,
        data: {
          totalReceivable,
          totalPayable,
          totalCashInHand,
          totalBankBalance,
          todayReceipts,
          todayPayments,
          todayReceiptCount,
          todayPaymentCount,
        },
      });
    } catch (error) {
      console.error("Accounts summary error:", error);
      return res.status(500).json({ success: false, message: "Failed to load accounts summary" });
    }
  },
};

export default dashboardController;
