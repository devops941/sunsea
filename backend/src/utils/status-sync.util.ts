import { PrismaClient } from "@prisma/client";

export class StatusSyncService {
  /**
   * Recalculates and syncs the Production Order status based on its scheduled quantities in WeeklyMachineProgram.
   * If a Sales Order is linked, it also recalculates the Sales Order's productionStatus.
   */
  static async syncProductionOrderStatus(
    prismaTx: any, // using any for transaction proxy
    productionOrderId: string
  ) {
    // 1. Fetch the Production Order and its related WeeklyMachinePrograms
    const productionOrder = await prismaTx.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        weeklyMachinePrograms: true,
      },
    });

    if (!productionOrder) return;

    // 2. Sum up all plannedQty for this Production Order
    const totalPlannedQty = productionOrder.weeklyMachinePrograms.reduce((sum: number, program: any) => {
      // Assuming program.plannedQty is a Decimal or number
      const qty = Number(program.plannedQty || 0);
      return sum + qty;
    }, 0);

    const targetQty = Number(productionOrder.targetQty || 0);

    // 3. Determine the new status
    let newStatus = productionOrder.status;

    if (totalPlannedQty === 0) {
      if (productionOrder.status === "PLANNED" || productionOrder.status === "PARTIALLY_PLANNED" || productionOrder.status === "SCHEDULED" || productionOrder.status === "SCHEDULE_DELETED") {
        newStatus = "READY_FOR_PLANNING";
      }
      // Otherwise keep its existing status (e.g., RM_AVAILABLE)
    } else if (totalPlannedQty > 0 && totalPlannedQty < targetQty) {
      newStatus = "PARTIALLY_PLANNED";
    } else if (totalPlannedQty >= targetQty) {
      newStatus = "SCHEDULED";
    }

    // Keep existing statuses if they are further along the workflow
    if (productionOrder.status === "IN_PROGRESS" || productionOrder.status === "COMPLETED") {
      newStatus = productionOrder.status;
    }

    // 4. Update the Production Order if status changed
    if (newStatus !== productionOrder.status) {
      await prismaTx.productionOrder.update({
        where: { productionOrderId },
        data: { status: newStatus },
      });
    }

    // 5. Sync Sales Order if linked
    if (productionOrder.sourceSalesOrderId) {
      await this.syncSalesOrderProductionStatus(prismaTx, productionOrder.sourceSalesOrderId);
    }
  }

  /**
   * Recalculates the Sales Order productionStatus based on its children Production Orders.
   */
  static async syncSalesOrderProductionStatus(
    prismaTx: any,
    sourceSalesOrderId: string
  ) {
    // Determine the Sales Order ID
    let salesOrderIdToUpdate: number | null = null;

    if (!isNaN(Number(sourceSalesOrderId))) {
      salesOrderIdToUpdate = Number(sourceSalesOrderId);
    } else {
      const so = await prismaTx.salesOrder.findUnique({ where: { orderNo: sourceSalesOrderId } });
      if (so) salesOrderIdToUpdate = so.id;
    }

    if (!salesOrderIdToUpdate) return;

    // Fetch all Production Orders for this Sales Order
    // Try by orderNo first, then by ID
    let productionOrders = await prismaTx.productionOrder.findMany({
      where: { sourceSalesOrderId },
    });

    if (productionOrders.length === 0) {
      // If we couldn't find them by orderNo, maybe sourceSalesOrderId was the ID as string
      productionOrders = await prismaTx.productionOrder.findMany({
        where: { sourceSalesOrderId: String(salesOrderIdToUpdate) },
      });
    }

    if (productionOrders.length === 0) return;

    // Determine the overall status
    let hasInProgress = false;
    let hasCompleted = false;
    let hasPlanned = false;
    let hasPartiallyPlanned = false;
    let hasNotStarted = false;

    for (const po of productionOrders) {
      switch (po.status) {
        case "IN_PROGRESS":
          hasInProgress = true;
          break;
        case "COMPLETED":
          hasCompleted = true;
          break;
        case "PLANNED":
          hasPlanned = true;
          break;
        case "PARTIALLY_PLANNED":
          hasPartiallyPlanned = true;
          break;
        case "NOT_STARTED":
        case "PENDING":
          hasNotStarted = true;
          break;
        default:
          // Treat other statuses as NOT_STARTED or ignore
          break;
      }
    }

    let newSoStatus = "NOT_STARTED";

    if (hasInProgress) {
      newSoStatus = "IN_PROGRESS";
    } else if (hasCompleted && !hasInProgress && !hasPlanned && !hasPartiallyPlanned && !hasNotStarted) {
      newSoStatus = "COMPLETED";
    } else if (hasPlanned || hasPartiallyPlanned) {
      newSoStatus = "PLANNED";
    } else if (hasNotStarted && !hasPlanned && !hasPartiallyPlanned && !hasCompleted && !hasInProgress) {
      newSoStatus = "NOT_STARTED";
    } else if (hasCompleted && hasNotStarted) {
      // Mix of completed and not started
      newSoStatus = "IN_PROGRESS";
    }

    await prismaTx.salesOrder.update({
      where: { id: salesOrderIdToUpdate },
      data: { productionStatus: newSoStatus },
    });
  }
}
