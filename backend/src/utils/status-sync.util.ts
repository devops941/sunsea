import { PrismaClient } from "@prisma/client";

// =====================================================================
// PRODUCTION ORDER STATUS WORKFLOW (ERP Standard)
// CREATED → READY_FOR_PLANNING → WEEKLY_SCHEDULED → DAILY_PLANNED
// → IN_PRODUCTION → POST_PRODUCTION → PARTIAL_COMPLETED → READY_FOR_DISPATCH → DISPATCHED
// =====================================================================

export const PRODUCTION_STATUS = {
  CREATED: "CREATED",
  WAITING_FOR_MATERIAL: "WAITING_FOR_MATERIAL",
  READY_FOR_PLANNING: "READY_FOR_PLANNING",
  WEEKLY_SCHEDULED: "WEEKLY_SCHEDULED",
  DAILY_PLANNED: "DAILY_PLANNED",
  IN_PRODUCTION: "IN_PRODUCTION",
  POST_PRODUCTION: "POST_PRODUCTION",
  PARTIAL_COMPLETED: "PARTIAL_COMPLETED",
  COMPLETED_WITH_SHORTFALL: "COMPLETED_WITH_SHORTFALL",
  CLOSED: "CLOSED",
  READY_FOR_DISPATCH: "READY_FOR_DISPATCH",
  DISPATCHED: "DISPATCHED",
  COMPLETED: "COMPLETED",       // legacy alias for READY_FOR_DISPATCH
  CANCELLED: "CANCELLED",
} as const;

// Statuses that are "further along" than weekly scheduling
export const LOCKED_STATUSES = [
  "DAILY_PLANNED",
  "IN_PRODUCTION",
  "POST_PRODUCTION",
  "PARTIAL_COMPLETED",
  "COMPLETED_WITH_SHORTFALL",
  "CLOSED",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "CANCELLED",
];

export class StatusSyncService {
  /**
   * Logs a production order status transition to the history table.
   */
  static async logHistory(
    prismaTx: any,
    productionOrderId: string,
    fromStatus: string | null | undefined,
    toStatus: string,
    changedBy?: string | null,
    remarks?: string | null,
    action?: string | null,
    metadata?: any
  ) {
    try {
      await prismaTx.productionOrderHistory.create({
        data: {
          productionOrderId,
          fromStatus: fromStatus || null,
          toStatus,
          changedBy: changedBy || null,
          remarks: remarks || null,
          action: action || null,
          metadata: metadata || null,
        },
      });
    } catch (e) {
      // Never let history logging break the main transaction
      console.error("[StatusSyncService] Failed to log history:", e);
    }
  }

  /**
   * Recalculates and syncs the Production Order status based on its
   * weekly/daily schedule state. Uses correct ERP workflow statuses.
   *
   * Rules:
   *  - If no weekly schedules exist → revert to READY_FOR_PLANNING (if was WEEKLY_SCHEDULED)
   *  - If weekly schedule exists → WEEKLY_SCHEDULED
   *  - Never downgrade statuses that are beyond DAILY_PLANNED
   */
  static async syncProductionOrderStatus(
    prismaTx: any,
    productionOrderId: string,
    changedBy?: string
  ) {
    const productionOrder = await prismaTx.productionOrder.findUnique({
      where: { productionOrderId },
      include: {
        weeklyMachinePrograms: true,
        dailyProductionPlans: true,
      },
    });

    if (!productionOrder) return;

    const currentStatus = productionOrder.status;

    // Never downgrade statuses that are beyond WEEKLY_SCHEDULED
    if (LOCKED_STATUSES.includes(currentStatus)) {
      return;
    }

    const activeWeeklyPrograms = productionOrder.weeklyMachinePrograms.filter(
      (p: any) =>
        !["CANCELLED", "COMPLETED"].includes(p.status)
    );

    const totalPlannedQty = activeWeeklyPrograms.reduce((sum: number, p: any) => {
      return sum + Number(p.plannedQty || 0);
    }, 0);

    const targetQty = Number(productionOrder.targetQty || 0);

    let newStatus = currentStatus;

    if (totalPlannedQty === 0) {
      // No active weekly schedules → revert to READY_FOR_PLANNING
      if (
        currentStatus === "WEEKLY_SCHEDULED" ||
        currentStatus === "SCHEDULED" ||       // legacy
        currentStatus === "PLANNED" ||          // legacy
        currentStatus === "PARTIALLY_PLANNED"   // legacy
      ) {
        newStatus = "READY_FOR_PLANNING";
      }
      // If it's READY_FOR_PLANNING or WAITING_FOR_MATERIAL already — keep it
    } else if (totalPlannedQty > 0) {
      // Has weekly schedules → WEEKLY_SCHEDULED
      newStatus = "WEEKLY_SCHEDULED";
    }

    if (newStatus !== currentStatus) {
      const previousStatus = currentStatus;
      await prismaTx.productionOrder.update({
        where: { productionOrderId },
        data: { status: newStatus },
      });
      await this.logHistory(
        prismaTx,
        productionOrderId,
        previousStatus,
        newStatus,
        changedBy,
        "Status synced by weekly schedule change",
        "SCHEDULE_SYNC"
      );
    }

    // Sync linked Sales Order
    if (productionOrder.sourceSalesOrderId) {
      await this.syncSalesOrderProductionStatus(
        prismaTx,
        productionOrder.sourceSalesOrderId
      );
    }
  }

  /**
   * Recalculates the Sales Order productionStatus based on its
   * children Production Orders.
   */
  static async syncSalesOrderProductionStatus(
    prismaTx: any,
    sourceSalesOrderId: string
  ) {
    let salesOrderIdToUpdate: number | null = null;

    if (!isNaN(Number(sourceSalesOrderId))) {
      salesOrderIdToUpdate = Number(sourceSalesOrderId);
    } else {
      const so = await prismaTx.salesOrder.findUnique({
        where: { orderNo: sourceSalesOrderId },
      });
      if (so) salesOrderIdToUpdate = so.id;
    }

    if (!salesOrderIdToUpdate) return;

    let productionOrders = await prismaTx.productionOrder.findMany({
      where: { sourceSalesOrderId },
    });

    if (productionOrders.length === 0) {
      productionOrders = await prismaTx.productionOrder.findMany({
        where: { sourceSalesOrderId: String(salesOrderIdToUpdate) },
      });
    }

    if (productionOrders.length === 0) return;

    let newSoStatus = "NOT_STARTED";

    const statuses = productionOrders.map((po: any) => po.status);

    if (statuses.some((s: string) => s === "DISPATCHED")) {
      newSoStatus = "DISPATCHED";
    } else if (statuses.some((s: string) => s === "READY_FOR_DISPATCH" || s === "PARTIAL_COMPLETED" || s === "COMPLETED_WITH_SHORTFALL" || s === "CLOSED" || s === "DISPATCHED" || s === "COMPLETED")) {
      newSoStatus = "READY_FOR_DISPATCH";
    } else if (statuses.some((s: string) => s === "POST_PRODUCTION")) {
      newSoStatus = "IN_PROGRESS";
    } else if (statuses.some((s: string) => s === "IN_PRODUCTION")) {
      newSoStatus = "IN_PROGRESS";
    } else if (statuses.some((s: string) => s === "DAILY_PLANNED")) {
      newSoStatus = "SCHEDULED";
    } else if (statuses.some((s: string) => s === "WEEKLY_SCHEDULED")) {
      newSoStatus = "PLANNED";
    } else if (statuses.some((s: string) => s === "READY_FOR_PLANNING")) {
      newSoStatus = "PLANNED";
    } else if (statuses.some((s: string) => s === "WAITING_FOR_MATERIAL")) {
      newSoStatus = "MATERIAL_PENDING";
    } else if (statuses.some((s: string) => s === "CREATED")) {
      newSoStatus = "NOT_STARTED";
    }

    await prismaTx.salesOrder.update({
      where: { id: salesOrderIdToUpdate },
      data: { productionStatus: newSoStatus },
    });
  }
}
