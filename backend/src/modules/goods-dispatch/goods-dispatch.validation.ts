import { z } from "zod";

// ── Create Dispatch ─────────────────────────────────────────────────────────

export const createGoodsDispatchSchema = z.object({
  body: z.object({
    dispatchDate: z.string().min(1, "Dispatch date is required"),
    vehicleNumber: z.string().min(1, "Vehicle number is required").max(30),
    driverName: z.string().min(1, "Driver name is required").max(100),
    driverMobile: z.string().max(20).optional(),
    transportName: z.string().max(100).optional(),
    loadingTime: z.string().max(10).optional(),
    remarks: z.string().max(500).optional(),
    destinationStoreId: z.string().optional(),
    items: z
      .array(
        z.object({
          productionOrderId: z.string().min(1, "Production Order ID is required"),
          productItemId: z.number().or(z.string()),
          dispatchQty: z.number().positive("Dispatch quantity must be greater than 0"),
          uom: z.string().min(1, "UOM is required"),
          bypassGate: z.boolean().optional().default(false),
          remarks: z.string().optional(),
        })
      )
      .min(1, "At least one production order item is required"),
  }),
});

// ── Gate Approve ────────────────────────────────────────────────────────────

export const gateApproveSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    action: z.enum(["APPROVE", "REJECT"]),
    remarks: z.string().max(500).optional(),
  }),
});

// ── Store Receive ───────────────────────────────────────────────────────────

export const storeReceiveSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    action: z.enum(["APPROVE", "REJECT"]),
    remarks: z.string().max(500).optional(),
    receivedItems: z
      .array(
        z.object({
          itemId: z.number().or(z.string()).transform(Number),
          receivedQty: z.number().nonnegative(),
        })
      )
      .optional(),
  }),
});

// ── Query Params ────────────────────────────────────────────────────────────

export const goodsDispatchQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

// ── Eligible Orders Query ────────────────────────────────────────────────────

export const eligibleOrdersQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    productItemId: z.string().optional(),
    machineId: z.string().optional(),
    batchNo: z.string().optional(),
    shiftId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

export type CreateGoodsDispatchInput = z.infer<typeof createGoodsDispatchSchema>["body"];
export type GateApproveInput = z.infer<typeof gateApproveSchema>["body"];
export type StoreReceiveInput = z.infer<typeof storeReceiveSchema>["body"];
