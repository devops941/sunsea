import { z } from "zod";

// ── Create Dispatch ─────────────────────────────────────────────────────────

export const createGoodsDispatchSchema = z.object({
  body: z.object({
    dispatchDate: z.string().min(1, "Dispatch date is required"),
    dcNumber: z.string().min(1, "DC Number is required").max(100, "DC Number cannot exceed 100 characters"),
    destinationStoreId: z.string().min(1, "Destination store is required"),
    vehicleNumber: z.string().max(30).optional(),
    driverName: z.string().max(100).optional(),
    driverMobile: z.string().max(20).optional(),
    loadingTime: z.string().max(10).optional(),
    remarks: z.string().max(500).optional(),
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

// ── Update Dispatch ─────────────────────────────────────────────────────────

export const updateGoodsDispatchSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    dispatchDate: z.string().min(1, "Dispatch date is required").optional(),
    dcNumber: z.string().min(1, "DC Number is required").max(100).optional(),
    destinationStoreId: z.string().min(1, "Destination store is required").optional(),
    vehicleNumber: z.string().max(30).optional().nullable(),
    driverName: z.string().max(100).optional().nullable(),
    driverMobile: z.string().max(20).optional().nullable(),
    loadingTime: z.string().max(10).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
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
export type UpdateGoodsDispatchInput = z.infer<typeof updateGoodsDispatchSchema>["body"];
export type GateApproveInput = z.infer<typeof gateApproveSchema>["body"];
export type StoreReceiveInput = z.infer<typeof storeReceiveSchema>["body"];
