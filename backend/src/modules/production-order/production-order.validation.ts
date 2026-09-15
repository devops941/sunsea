import { z } from "zod";

import { PRODUCTION_STATUS } from "../../utils/status-sync.util";

/**
 * Production Order Status Enum
 */
export const ProductionOrderStatusEnum = z.enum(Object.keys(PRODUCTION_STATUS) as [string, ...string[]]);
export type ProductionOrderStatus = z.infer<typeof ProductionOrderStatusEnum>;

export const productionOrderBodyShape = z.object({
  productionOrderId: z
    .string()
    .min(1, "Production Order ID is required")
    .max(20, "Production Order ID must be at most 20 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Order ID must be alphanumeric with dashes only"),

  orderDate: z
    .string()
    .min(1, "Order Date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Order Date must be a valid ISO date (YYYY-MM-DD)"),

  dueDate: z
    .string()
    .min(1, "Due Date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Due Date must be a valid ISO date (YYYY-MM-DD)"),

  productItemId: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)), "Product Item ID must be a valid number or numeric string"),

  targetQty: z
    .number()
    .positive("Target Qty must be positive")
    .refine(
      (val) => Math.round(val * 100) / 100 === val,
      "Target Qty may have at most 2 decimal places"
    ),

  producedQty: z.number().min(0, "Produced Qty must be non-negative").optional().default(0),
  rejectedQty: z.number().min(0, "Rejected Qty must be non-negative").optional().default(0),
  scrapQty: z.number().min(0, "Scrap Qty must be non-negative").optional().default(0),

  uom: z
    .string()
    .min(1, "UOM is required")
    .max(10),

  priority: z.string().max(20).optional().default("MEDIUM"),
  orderType: z.string().max(30).optional().default("STANDARD"),

  batchNo: z.string().max(40).optional().nullable(),

  sourceStoreId: z.string().max(20).optional().nullable(),
  routingId: z.string().max(20).optional().nullable(),
  machineMachineId: z.string().max(20).optional().nullable(),

  weekStartDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid week start date"),

  weekEndDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid week end date"),

  status: z
    .string()
    .max(20)
    .optional()
    .default(PRODUCTION_STATUS.CREATED),

  remarks: z
    .string()
    .max(255)
    .optional()
    .nullable(),

  rawMaterials: z.array(
    z.object({
      rawMaterialId: z.string().min(1, "Raw Material ID is required"),
      requiredQty: z.number().min(0.000001, "Required Qty must be greater than 0"),
      uom: z.string().min(1, "UOM is required and must not be empty"),
      storeId: z.string().min(1, "Store ID is required"),
      remarks: z.string().optional().nullable(),
    })
  ).optional().default([]),
});

export const createProductionOrderSchema = z.object({
  body: productionOrderBodyShape.superRefine((data, ctx) => {
    if (data.dueDate && data.orderDate) {
      if (new Date(data.dueDate) < new Date(data.orderDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date must be after order date", path: ["dueDate"] });
      }
    }
    if (data.weekStartDate && data.weekEndDate) {
      if (new Date(data.weekEndDate) < new Date(data.weekStartDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Week End Date must be on or after Week Start Date", path: ["weekEndDate"] });
      }
    }
  }),
});

export const updateProductionOrderSchema = z.object({
  body: productionOrderBodyShape
    .omit({ productionOrderId: true })
    .partial()
    .superRefine((data, ctx) => {
      if (data.dueDate && data.orderDate) {
        if (new Date(data.dueDate) < new Date(data.orderDate)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date must be after order date", path: ["dueDate"] });
        }
      }
      if (data.weekStartDate && data.weekEndDate) {
        if (new Date(data.weekEndDate) < new Date(data.weekStartDate)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Week End Date must be on or after Week Start Date", path: ["weekEndDate"] });
        }
      }
    }),
  params: z.object({
    productionOrderId: z
      .string()
      .min(1, "Production Order ID is required")
      .max(20),
  }),
});

export const productionOrderIdSchema = z.object({
  params: z.object({
    productionOrderId: z
      .string()
      .min(1, "Production Order ID is required")
      .max(20),
  }),
});

export const productionOrderQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default("1")
      .transform(Number)
      .refine((val) => val > 0, "Page must be greater than 0"),

    pageSize: z
      .string()
      .optional()
      .default("20")
      .transform(Number)
      .refine((val) => val > 0 && val <= 100000, "Page size must be between 1 and 100000"),

    productItemId: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Number(val)), "Product Item ID must be a valid number"),

    productionOrderId: z
      .string()
      .max(20, "Production Order ID must be less than 20 characters")
      .optional(),

    status: z.string().optional(),

    search: z.string().optional(),

    fromDate: z
      .string()
      .optional()
      .refine((val) => val ? !isNaN(Date.parse(val)) : true, "Invalid from date"),

    toDate: z
      .string()
      .optional()
      .refine((val) => val ? !isNaN(Date.parse(val)) : true, "Invalid to date"),

    sortBy: z
      .enum(["orderDate", "createdAt", "dueDate", "productionOrderId"])
      .optional()
      .default("createdAt"),

    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .default("desc"),
  })
});

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>["body"];
export type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>["body"];
export type ProductionOrderQueryInput = z.infer<typeof productionOrderQuerySchema>["query"];

export const issueMaterialsSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        rawMaterialId: z.string().min(1, "Raw Material ID is required"),
        storeId: z.string().min(1, "Store ID is required"),
        qty: z.number().positive("Quantity must be positive"),
        remarks: z.string().optional(),
      })
    ).min(1, "At least one material item is required to issue"),
  }),
});

export type IssueMaterialsInput = z.infer<typeof issueMaterialsSchema>["body"];

export const machineProgramQuerySchema = z.object({
  query: z.object({
    machineId: z.string().min(1, "Machine ID is required"),
    weekStartDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid week start date"),
  }),
});

export type MachineProgramQueryInput = z.infer<typeof machineProgramQuerySchema>["query"];
