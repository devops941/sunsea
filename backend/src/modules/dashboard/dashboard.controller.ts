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

        // Products — id, name, code, minimumQty, rate, uom, category, finishedGoodsStocks
        prisma.product.findMany({
          where: { isActive: true },
          select: {
            id: true,
            productName: true,
            productCode: true,
            minimumQty: true,
            rate: true,
            uom: { select: { id: true, uomName: true, uomCode: true } },
            category: { select: { id: true, name: true } },
            finishedGoodsStocks: {
              select: {
                onHandQty: true,
                storeId: true,
              },
            },
          },
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
            reservedQty: true,
            minimumStock: true,
            reorderLevel: true,
            rate: true,
            storeId: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
            store: { select: { storeId: true, storeName: true } },
            itemType: true,
            isActive: true,
            status: true,
          },
          orderBy: { rawMaterialId: "asc" },
        }).catch(() => []),

        // Finished Goods Stocks
        prisma.finishedGoodsStock.findMany({
          select: {
            onHandQty: true,
            productItemId: true,
            storeId: true,
            product: {
              select: {
                id: true,
                productName: true,
                productCode: true,
                minimumQty: true,
                rate: true,
                uom: { select: { id: true, uomName: true, uomCode: true } },
                category: { select: { id: true, name: true } },
              },
            },
            store: { select: { storeId: true, storeName: true } },
          },
        }).catch(() => []),

        // Daily Plans (exclude DRAFT status)
        prisma.dailyProductionPlan.findMany({
          where: {
            status: { not: "DRAFT" },
          },
          select: {
            dailyPlanId: true,
            productionDate: true,
            status: true,
            productionOrderId: true,
            plannedQty: true,
            priority: true,
            machine: { select: { machineName: true } },
            shift: { select: { shiftName: true } },
            productionOrder: {
              select: {
                productionOrderId: true,
                targetQty: true,
                producedQty: true,
                productItem: { select: { productName: true } },
              },
            },
            weeklyMachineProgram: {
              select: {
                machine: { select: { machineName: true } },
                shift: { select: { shiftName: true } },
              },
            },
          },
          orderBy: { productionDate: "desc" },
          take: 200,
        }).catch(() => []),

        // Sales Invoices for pending amount and trend chart
        prisma.salesInvoice.findMany({
          select: {
            id: true,
            salesOrderId: true,
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

      // ─── Period filter (independent for sales & purchase) ───────────
      const defaultPeriod = (req.query.period as string) || "year";
      const salesPeriod = (req.query.salesPeriod as string) || defaultPeriod;
      const purchasePeriod = (req.query.purchasePeriod as string) || defaultPeriod;
      const now = new Date();

      const getPeriodBounds = (p: string) => {
        let pStart: Date;
        let pEnd: Date;
        if (p === "day") {
          pStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (p === "week") {
          pStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          pStart.setHours(0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (p === "month") {
          pStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else {
          // year — current financial/calendar year from Jan 1
          pStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
        return { pStart, pEnd };
      };

      const { pStart: salesStart, pEnd: salesEnd } = getPeriodBounds(salesPeriod);
      const { pStart: purchaseStart, pEnd: purchaseEnd } = getPeriodBounds(purchasePeriod);

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
            select: { id: true, customerId: true, customer: { select: { firmName: true, displayName: true, openingBalance: true, openingBalanceType: true } } },
          }),
          tx.accountLedger.findMany({
            where: { supplierId: { not: null } },
            select: { id: true, supplier: { select: { legalName: true, displayName: true, openingBalance: true, openingBalanceType: true } } },
          }),
          tx.salesInvoice.findMany({
            select: { id: true, grandTotal: true, payments: true, status: true, invoiceDate: true, createdAt: true },
            where: {
              status: { not: "CANCELLED" },
              invoiceDate: { gte: salesStart, lte: salesEnd },
            },
          }),
          (tx as any).grnInvoice.findMany({
            select: { id: true, netAmount: true, subtotal: true, payments: true, createdAt: true, grnDate: true },
            where: {
              OR: [
                { grnDate: { gte: purchaseStart, lte: purchaseEnd } },
                { createdAt: { gte: purchaseStart, lte: purchaseEnd } },
              ],
            },
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
      const receivableDetails: Array<{ name: string; amount: number; customerId: string }> = [];
      for (const cl of customerLedgers) {
        const netDr = (debitMap.get(cl.id) || 0) - (creditMap.get(cl.id) || 0);
        if (netDr > 0.005) {
          totalReceivable += netDr;
          receivableCustomerCount++;
          receivableDetails.push({
            name: cl.customer?.displayName || cl.customer?.firmName || "Unknown",
            amount: netDr,
            customerId: cl.customerId || "",
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
      const alerts: Array<{ level: "info" | "warn" | "danger"; message: string; link?: string; details?: Array<{ name: string; amount: string; customerId?: string }> }> = [];
      if (totalReceivable > 0) {
        alerts.push({
          level: "danger",
          message: `Total outstanding receivable: ${fmtINR(totalReceivable)} (${receivableCustomerCount} customer${receivableCustomerCount > 1 ? "s" : ""})`,
          link: "/accounts/receivable",
          details: receivableDetails.map((d) => ({ name: d.name, amount: fmtINR(d.amount), customerId: d.customerId })),
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

      // ─── Credit Days Overdue — Purchase & Payment (separate sections) ───
      // Derive lastPurchaseDate / lastPaymentDate from the account ledger (vouchers)
      // for customers who have creditDays set and outstanding balance > 0
      const purchaseOverdue: Array<{ customerId: string; name: string; daysSince: number; creditDays: number; outstanding: number; lastDate: string }> = [];
      const paymentOverdue: Array<{ customerId: string; name: string; daysSince: number; creditDays: number; outstanding: number; lastDate: string }> = [];
      try {
        const creditCustomers = await prisma.customer.findMany({
          where: {
            creditDays: { not: null, gt: 0 },
            status: "Active",
          },
          select: {
            id: true,
            firmName: true,
            displayName: true,
            creditDays: true,
            outstandingAmount: true,
            accountLedger: { select: { id: true } },
          },
        });

        // Get customers with ledger accounts
        const custsWithLedger = creditCustomers.filter(c => c.accountLedger);
        const ledgerIdToCustomer = new Map<number, typeof custsWithLedger[0]>();
        for (const c of custsWithLedger) {
          if (c.accountLedger) ledgerIdToCustomer.set(c.accountLedger.id, c);
        }

        if (ledgerIdToCustomer.size > 0) {
          const ledgerIds = [...ledgerIdToCustomer.keys()];

          // Compute real net balance per customer ledger from journal items (debit - credit)
          const balanceRaw: any[] = await prisma.$queryRaw`
            SELECT
              COALESCE(d."ledgerId", c."ledgerId") AS "ledgerId",
              COALESCE(d."totalDebit", 0) - COALESCE(c."totalCredit", 0) AS "netBalance"
            FROM
              (SELECT "debitLedgerId" AS "ledgerId", SUM("debitAmount") AS "totalDebit"
               FROM journal_items WHERE "debitLedgerId" = ANY(${ledgerIds}::int[]) GROUP BY "debitLedgerId") d
            FULL OUTER JOIN
              (SELECT "creditLedgerId" AS "ledgerId", SUM("creditAmount") AS "totalCredit"
               FROM journal_items WHERE "creditLedgerId" = ANY(${ledgerIds}::int[]) GROUP BY "creditLedgerId") c
            ON d."ledgerId" = c."ledgerId"
          `;
          const balanceMap = new Map<number, number>(balanceRaw.map(r => [r.ledgerId, Number(r.netBalance || 0)]));


          const lastSalesRaw: any[] = await prisma.$queryRaw`
            SELECT ji."debitLedgerId" AS "ledgerId", MAX(v."date") AS "lastDate"
            FROM journal_items ji
            JOIN vouchers v ON v.id = ji."voucherId"
            WHERE ji."debitLedgerId" = ANY(${ledgerIds}::int[])
              AND v."type" = 'SALES'
            GROUP BY ji."debitLedgerId"
          `;
          const lastSalesMap = new Map<number, Date>(lastSalesRaw.map(r => [r.ledgerId, new Date(r.lastDate)]));

          const lastReceiptRaw: any[] = await prisma.$queryRaw`
            SELECT ji."creditLedgerId" AS "ledgerId", MAX(v."date") AS "lastDate"
            FROM journal_items ji
            JOIN vouchers v ON v.id = ji."voucherId"
            WHERE ji."creditLedgerId" = ANY(${ledgerIds}::int[])
              AND v."type" = 'RECEIPT'
            GROUP BY ji."creditLedgerId"
          `;
          const lastReceiptMap = new Map<number, Date>(lastReceiptRaw.map(r => [r.ledgerId, new Date(r.lastDate)]));

          // TODO: REMOVE — simulate Sep 17 for testing overdue alerts
          const nowMs = new Date("2026-09-18").getTime();
          // const nowMs = Date.now();

          for (const [ledgerId, c] of ledgerIdToCustomer) {
            const creditDays = c.creditDays!;
            const custName = c.displayName || c.firmName;
            const outstanding = balanceMap.get(ledgerId) || 0;

            // Purchase Overdue — show if no purchase in credit days period
            // (regardless of balance — customer is inactive, needs follow-up)
            const lastPurchaseDate = lastSalesMap.get(ledgerId);
            if (lastPurchaseDate) {
              const daysSincePurchase = Math.floor((nowMs - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSincePurchase > creditDays) {
                purchaseOverdue.push({
                  customerId: c.id,
                  name: custName,
                  daysSince: daysSincePurchase,
                  creditDays,
                  outstanding,
                  lastDate: lastPurchaseDate.toISOString(),
                });
              }
            }

            // Payment Overdue — only show if outstanding > 0
            // (if fully paid, no need to alert about payment)
            if (outstanding > 0) {
              const lastPaymentDate = lastReceiptMap.get(ledgerId);
              if (lastPaymentDate) {
                // Has paid before — check if last payment exceeded credit days
                const daysSincePayment = Math.floor((nowMs - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSincePayment > creditDays) {
                  paymentOverdue.push({
                    customerId: c.id,
                    name: custName,
                    daysSince: daysSincePayment,
                    creditDays,
                    outstanding,
                    lastDate: lastPaymentDate.toISOString(),
                  });
                }
              } else if (lastPurchaseDate) {
                // Never paid at all — use last purchase date to calculate overdue
                const daysSincePurchase = Math.floor((nowMs - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSincePurchase > creditDays) {
                  paymentOverdue.push({
                    customerId: c.id,
                    name: custName,
                    daysSince: daysSincePurchase,
                    creditDays,
                    outstanding,
                    lastDate: lastPurchaseDate.toISOString(),
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Credit days overdue alert error:", err);
      }

      // Sort by days overdue descending (most overdue first)
      purchaseOverdue.sort((a, b) => b.daysSince - a.daysSince);
      paymentOverdue.sort((a, b) => b.daysSince - a.daysSince);


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
          // Credit days overdue — separate lists for dedicated UI sections
          purchaseOverdue,
          paymentOverdue,
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
