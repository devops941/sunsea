import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType } from "@prisma/client";
import { getTvSummary } from "./dashboard.tv.service";

const dashboardController = {
  getSummary: async (req: Request, res: Response) => {
    try {
      const [
        salesOrders,
        purchaseOrders,
        productionOrders,
        productsCount,
        allCustomers,
        employeesCount,
        machines,
        weeklyPrograms,
        rawMaterials,
        finishedGoodsStocks,
        dailyPlans,
        salesInvoices,
        purchaseInvoices,
        allSalesProducts,
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
            customer: { select: { id: true, firmName: true } },
            items: {
              select: {
                productId: true,
                quantity: true,
                product: { select: { productName: true } },
                salesProductId: true,
                salesProduct: { select: { salesProductName: true } },
              },
            },
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

        // Products — id, name, code for report
        prisma.product.findMany({
          where: { isActive: true },
          select: { id: true, productName: true, productCode: true },
          orderBy: { productName: "asc" },
        }).catch(() => []),

        // Customers — for product purchase report
        prisma.customer.findMany({
          where: { deletedAt: null },
          select: { id: true, firmName: true, customerCode: true },
          orderBy: { firmName: "asc" },
        }).catch(() => []),

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

        // Sales Invoices for pending amount and trend chart
        prisma.salesInvoice.findMany({
          select: {
            id: true,
            grandTotal: true,
            payments: true,
            status: true,
            invoiceDate: true,
            createdAt: true,
          },
          where: {
            status: { not: "CANCELLED" },
          },
          orderBy: { createdAt: "desc" },
        }).catch(() => []),

        // Purchase / GRN Invoices for trend chart
        (prisma as any).grnInvoice.findMany({
          select: {
            id: true,
            netAmount: true,
            subtotal: true,
            payments: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }).catch(() => []),

        // Sales Products — for Customer Purchase Report
        prisma.salesProduct.findMany({
          where: { isActive: true },
          select: { id: true, salesProductName: true, salesProductCode: true },
          orderBy: { salesProductName: "asc" },
        }).catch(() => []),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          salesOrders,
          purchaseOrders,
          productionOrders,
          products: productsCount,
          productsCount: Array.isArray(productsCount) ? productsCount.length : productsCount,
          customers: allCustomers,
          salesProducts: allSalesProducts,
          employeesCount,
          machines,
          weeklyPrograms,
          rawMaterials,
          rawMaterialStocks: [],
          finishedGoodsStocks,
          dailyPlans,
          salesInvoices,
          purchaseInvoices,
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

      // ─── Period filter ────────────────────────────────────────────
      const period = (req.query.period as string) || "year";
      const now = new Date();
      let periodStart: Date;
      if (period === "day") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "week") {
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === "month") {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        // year — current financial/calendar year from Jan 1
        periodStart = new Date(now.getFullYear(), 0, 1);
      }
      const periodEnd = now;

      const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand", "BANK ACCOUNTS", "CASH IN HAND"];

      // Fetch all data in ONE transaction — shares 1 pool connection instead of 20+
      const {
        bankLedgers, customerLedgers, supplierLedgers,
        debitSums, creditSums,
        salesInvoices, purchaseInvoices,
        finishedStock, rawStock,
        recentVouchers, draftVouchers,
      } = await prisma.$transaction(async (tx) => {
        const [
          bankLedgers, customerLedgers, supplierLedgers,
          salesInvoices, purchaseInvoices,
          finishedStock, rawStock,
          recentVouchers, draftVouchers,
        ] = await Promise.all([
          tx.accountLedger.findMany({
            where: { type: LedgerType.ASSET, group: { in: bankGroups, mode: "insensitive" }, isActive: true },
            select: { id: true, code: true, name: true, group: true },
          }),
          tx.accountLedger.findMany({
            where: { customerId: { not: null } },
            select: { id: true, customer: { select: { firmName: true, displayName: true, openingBalance: true, openingBalanceType: true } } },
          }),
          tx.accountLedger.findMany({
            where: { supplierId: { not: null } },
            select: { id: true, supplier: { select: { legalName: true, displayName: true, openingBalance: true, openingBalanceType: true } } },
          }),
          tx.salesInvoice.findMany({
            select: { id: true, grandTotal: true, payments: true, status: true, invoiceDate: true, createdAt: true },
            where: {
              status: { not: "CANCELLED" },
              invoiceDate: { gte: periodStart, lte: periodEnd },
            },
          }),
          (tx as any).grnInvoice.findMany({
            select: { id: true, netAmount: true, subtotal: true, payments: true, createdAt: true },
            where: { createdAt: { gte: periodStart, lte: periodEnd } },
          }),
          tx.finishedGoodsStock.findMany({
            select: { onHandQty: true, product: { select: { rate: true } } },
          }),
          tx.rawMaterial.findMany({
            select: { onHandQty: true, rate: true },
          }),
          tx.voucher.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true, voucherNo: true, type: true, date: true, narration: true,
              items: {
                select: {
                  debitAmount: true, creditAmount: true,
                  debitLedger: { select: { name: true } },
                  creditLedger: { select: { name: true } },
                },
              },
            },
          }),
          tx.voucher.count({ where: { OR: [{ refDocType: "DRAFT" }, { narration: { contains: "draft", mode: "insensitive" } }] } }).catch(() => 0),
        ]);

        const ledgerIds = [
          ...bankLedgers.map((l) => l.id),
          ...customerLedgers.map((l) => l.id),
          ...supplierLedgers.map((l) => l.id),
        ];
        const [debitSums, creditSums] = ledgerIds.length === 0
          ? [[], []]
          : await Promise.all([
              tx.journalItem.groupBy({
                by: ["debitLedgerId"],
                where: { debitLedgerId: { in: ledgerIds } },
                _sum: { debitAmount: true },
              }),
              tx.journalItem.groupBy({
                by: ["creditLedgerId"],
                where: { creditLedgerId: { in: ledgerIds } },
                _sum: { creditAmount: true },
              }),
            ]);

        return {
          bankLedgers, customerLedgers, supplierLedgers,
          debitSums, creditSums,
          salesInvoices, purchaseInvoices,
          finishedStock, rawStock,
          recentVouchers, draftVouchers,
        };
      });

      const debitMap = new Map<number, number>(
        (debitSums as any[]).map((r) => [r.debitLedgerId as number, Number(r._sum?.debitAmount || 0)])
      );
      const creditMap = new Map<number, number>(
        (creditSums as any[]).map((r) => [r.creditLedgerId as number, Number(r._sum?.creditAmount || 0)])
      );

      // ─── Bank & Cash aggregation ─────────────────────────────
      const isCashAccount = (group: string, name: string) => {
        const g = (group || "").toLowerCase().trim();
        if (g === "cash in hand" || g === "cash") return true;
        // For legacy "Cash & Bank" group, check the account name
        if (g === "cash & bank") {
          const n = (name || "").toLowerCase();
          return n.includes("cash") && !n.includes("bank");
        }
        return false;
      };
      let totalBankBalance = 0;
      let totalCashInHand = 0;
      let cashAccountCount = 0;
      let bankAccountCount = 0;
      for (const l of bankLedgers) {
        const balance = (debitMap.get(l.id) || 0) - (creditMap.get(l.id) || 0);
        if (isCashAccount(l.group || "", l.name || "")) {
          totalCashInHand += balance;
          cashAccountCount++;
        } else {
          totalBankBalance += balance;
          bankAccountCount++;
        }
      }

      // ─── Receivable (customers owe us) — POSITIVE netDr only ─
      // Only customers with a Dr balance actually owe us money. A customer
      // sitting on a Cr balance (they paid advance, or credit note pending)
      // is NOT a receivable — it's a liability on our books. Excluded here
      // so the Dashboard tile / Amount Receivable page reflect real dues.
      let totalReceivable = 0;
      let totalCustomerAdvances = 0;
      let receivableCustomerCount = 0;
      let customerAdvanceCount = 0;
      const receivableDetails: Array<{ name: string; amount: number }> = [];
      for (const cl of customerLedgers) {
        const netDr = (debitMap.get(cl.id) || 0) - (creditMap.get(cl.id) || 0);
        if (netDr > 0.005) {
          totalReceivable += netDr;
          receivableCustomerCount++;
          receivableDetails.push({
            name: cl.customer?.displayName || cl.customer?.firmName || "Unknown",
            amount: netDr,
          });
        } else if (netDr < -0.005) {
          totalCustomerAdvances += -netDr;
          customerAdvanceCount++;
        }
      }
      receivableDetails.sort((a, b) => b.amount - a.amount);

      // ─── Payable (we owe suppliers) — POSITIVE netCr only ─────
      // Mirror of receivable rule: a supplier with a Dr balance (we paid
      // advance, or debit note pending from them) is NOT a payable — it's
      // an asset on our books.
      let totalPayable = 0;
      let totalSupplierAdvances = 0;
      let payableSupplierCount = 0;
      let supplierAdvanceCount = 0;
      const payableDetails: Array<{ name: string; amount: number }> = [];
      for (const sl of supplierLedgers) {
        const netCr = (creditMap.get(sl.id) || 0) - (debitMap.get(sl.id) || 0);
        if (netCr > 0.005) {
          totalPayable += netCr;
          payableSupplierCount++;
          payableDetails.push({
            name: sl.supplier?.displayName || sl.supplier?.legalName || "Unknown",
            amount: netCr,
          });
        } else if (netCr < -0.005) {
          totalSupplierAdvances += -netCr;
          supplierAdvanceCount++;
        }
      }
      payableDetails.sort((a, b) => b.amount - a.amount);

      // ─── Sales / Purchase invoice totals ─────────────────────
      const totalSales = salesInvoices.reduce((s: number, inv: any) => s + Number(inv.grandTotal || 0), 0);
      const totalPurchase = purchaseInvoices.reduce((s: number, inv: any) => s + Number(inv.netAmount || inv.subtotal || 0), 0);
      const salesVoucherCount = salesInvoices.length;
      const purchaseVoucherCount = purchaseInvoices.length;

      // ─── Stock value ─────────────────────────────────────────
      const finishedValue = finishedStock.reduce((s: number, r: any) => s + Number(r.onHandQty || 0) * Number(r.product?.rate || 0), 0);
      const rawValue = rawStock.reduce((s: number, r: any) => s + Number(r.onHandQty || 0) * Number(r.rate || 0), 0);
      const stockValue = finishedValue + rawValue;
      const stockItemCount = finishedStock.length + rawStock.length;

      // ─── Today's Receipts / Payments ─────────────────────────
      const todayVouchers = recentVouchers.filter((v: any) => {
        const d = new Date(v.date);
        return d >= today && d < tomorrow;
      });
      let todayReceipts = 0;
      let todayPayments = 0;
      let todayReceiptCount = 0;
      let todayPaymentCount = 0;
      for (const v of todayVouchers) {
        const amt = v.items.reduce((s: number, i: any) => s + Number(i.debitAmount || 0), 0);
        if (v.type === VoucherType.RECEIPT) { todayReceipts += amt; todayReceiptCount++; }
        else if (v.type === VoucherType.PAYMENT) { todayPayments += amt; todayPaymentCount++; }
      }

      // ─── Recent Transactions (last 10 vouchers, decorated) ───
      const recentTransactions = recentVouchers.slice(0, 10).map((v: any) => {
        const totalDr = v.items.reduce((s: number, i: any) => s + Number(i.debitAmount || 0), 0);
        // Party = the "opposite side" from bank/cash. For SALES: debit ledger = customer; for PAYMENT: credit ledger = bank, debit = supplier.
        const debitName = v.items[0]?.debitLedger?.name || "";
        const creditName = v.items[0]?.creditLedger?.name || "";
        return {
          id: v.id,
          voucherNo: v.voucherNo,
          type: v.type,
          date: v.date,
          narration: v.narration,
          amount: totalDr,
          debitLedger: debitName,
          creditLedger: creditName,
        };
      });

      // ─── Alerts — each item is a scrollable clickable row ───
      const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const alerts: Array<{ level: "info" | "warn" | "danger"; message: string; link?: string; details?: Array<{ name: string; amount: string }> }> = [];
      if (totalReceivable > 0) {
        alerts.push({
          level: "danger",
          message: `Total outstanding receivable: ${fmtINR(totalReceivable)} (${receivableCustomerCount} customer${receivableCustomerCount > 1 ? "s" : ""})`,
          link: "/accounts/receivable",
          details: receivableDetails.map((d) => ({ name: d.name, amount: fmtINR(d.amount) })),
        });
      }
      if (totalPayable > 0) {
        alerts.push({
          level: "danger",
          message: `Total outstanding payable: ${fmtINR(totalPayable)} (${payableSupplierCount} supplier${payableSupplierCount > 1 ? "s" : ""})`,
          link: "/accounts/payable",
          details: payableDetails.map((d) => ({ name: d.name, amount: fmtINR(d.amount) })),
        });
      }
      if (draftVouchers > 0) {
        alerts.push({
          level: "info",
          message: `${draftVouchers} unposted draft voucher${draftVouchers > 1 ? "s" : ""} — need review`,
          link: "/accounts/ledger-statement",
        });
      }
      const zeroStockCount = rawStock.filter((r: any) => Number(r.onHandQty || 0) <= 0).length;
      if (zeroStockCount > 0) {
        alerts.push({
          level: "warn",
          message: `${zeroStockCount} raw material${zeroStockCount > 1 ? "s have" : " has"} zero stock — reorder needed`,
          link: "/raw-materials",
        });
      }
      const negativeBankAccounts = bankLedgers.filter((l) => {
        const bal = (debitMap.get(l.id) || 0) - (creditMap.get(l.id) || 0);
        return bal < 0;
      });
      if (negativeBankAccounts.length > 0) {
        alerts.push({
          level: "warn",
          message: `${negativeBankAccounts.length} bank/cash account${negativeBankAccounts.length > 1 ? "s show" : " shows"} negative balance — check entries`,
          link: "/accounts/bank-accounts",
        });
      }

      return res.json({
        success: true,
        data: {
          // 6 top cards
          totalSales, salesVoucherCount,
          totalPurchase, purchaseVoucherCount,
          totalReceivable, receivableCustomerCount,
          totalCustomerAdvances, customerAdvanceCount,
          totalPayable, payableSupplierCount,
          totalSupplierAdvances, supplierAdvanceCount,
          totalCashInHand, totalBankBalance,
          cashBankAccountCount: bankLedgers.length,
          cashAccountCount, bankAccountCount,
          stockValue, stockItemCount,
          // Extras
          todayReceipts, todayPayments, todayReceiptCount, todayPaymentCount,
          recentTransactions,
          alerts,
        },
      });
    } catch (error) {
      console.error("Accounts summary error:", error);
      return res.status(500).json({ success: false, message: "Failed to load accounts summary" });
    }
  },
   getTvSummary: async (_req: Request, res: Response) => {
    try {
      const data = await getTvSummary();
      return res.json({ success: true, data });
    } catch (error) {
      console.error("TV summary error:", error);
      return res.status(500).json({ success: false, message: "Failed to load TV dashboard data" });
    }
  },
};

export default dashboardController;
