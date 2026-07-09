import { z } from "zod";

const ItemCategoryTypeEnum = z.enum(["RAW_MATERIAL", "FINISHED_GOODS", "SEMI_FINISHED"]);
const AdjustmentStatusEnum = z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]);

const stockAdjustmentItemSchema = z.object({
  id: z.union([z.string(), z.number(), z.bigint()]).optional(),
  itemType: ItemCategoryTypeEnum,
  rawMaterialId: z.string().optional().nullable(),
  productItemId: z.union([z.string(), z.number(), z.bigint()]).optional().nullable(),
  storeId: z.string().min(1, "Store ID is required"),
  currentQty: z.number(),
  adjustedQty: z.number(),
  difference: z.number(),
  remarks: z.string().max(255).optional().nullable(),
}).refine(data => {
  if (data.itemType === 'RAW_MATERIAL') return !!data.rawMaterialId;
  if (data.itemType === 'FINISHED_GOODS') return !!data.productItemId;
  return true;
}, {
  message: "Raw Material or Product ID is required based on Item Type",
  path: ["rawMaterialId"], // or productItemId
});

const createBodySchema = z.object({
  adjustmentNumber: z.string().min(1, "Adjustment number is required"),
  adjustmentDate: z.string().or(z.date()),
  reason: z.string().max(255).optional().nullable(),
  status: AdjustmentStatusEnum.optional(),
  items: z.array(stockAdjustmentItemSchema).min(1, "At least one item is required"),
});

export const createStockAdjustmentSchema = z.object({
  body: createBodySchema,
});

export const updateStockAdjustmentSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID is required"),
  }),
  body: createBodySchema.partial().extend({
    items: z.array(stockAdjustmentItemSchema).optional(),
  }),
});

export const updateStockAdjustmentStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID is required"),
  }),
  body: z.object({
    status: AdjustmentStatusEnum,
    reason: z.string().optional(),
  }),
});

export const stockAdjustmentIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID is required"),
  }),
});
