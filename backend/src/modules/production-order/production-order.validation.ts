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
    .max(20),

  orderDate: z
    .string()
    .datetime({ message: "Invalid order date format" })
    .refine((val) => !isNaN(Date.parse(val)), "Invalid order date string"),

  dueDate: z
    .string()
    .datetime({ message: "Invalid due date format" })
    .refine((val) => !isNaN(Date.parse(val)), "Invalid due date string"),

  productItemId: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)), "Product Item ID must be a valid number or numeric string"),

  targetQty: z
    .number()
    .positive("Target Qty must be positive"),

  producedQty: z.number().min(0).optional().default(0),
  rejectedQty: z.number().min(0).optional().default(0),
  scrapQty: z.number().min(0).optional().default(0),

  uom: z
    .string()
    .min(1, "UOM is required")
    .max(10),

  priority: z.string().max(20).optional().default("MEDIUM"),
  orderType: z.string().max(30).optional().default("STANDARD"),

  batchNo: z.string().max(40).optional().nullable(),
  lotNo: z.string().max(40).optional().nullable(),

  sourceSalesOrderId: z
    .string()
    .max(20)
    .optional()
    .nullable(),

  sourceSalesOrderLineId: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      (val) => val === undefined || val === null || !isNaN(Number(val)),
      "Source Sales Order Line ID must be a numeric string"
    ),

  sourceStoreId: z.string().max(20).optional().nullable(),
  destinationStoreId: z.string().max(20).optional().nullable(),
  billOfMaterialId: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine((val) => val === undefined || val === null || !isNaN(Number(val)), 'Bill Of Material ID must be a numeric string'),
  routingId: z.string().max(20).optional().nullable(),
  machineMachineId: z.string().max(20).optional().nullable(),

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

  approvedBy: z.string().max(36).optional().nullable(),
  approvedAt: z.string().datetime({ message: "Invalid approved at datetime" }).optional().nullable(),

  rawMaterials: z.array(
    z.object({
      rawMaterialId: z.string().min(1, "Raw Material ID is required"),
      requiredQty: z.number().positive("Required Qty must be positive"),
      uom: z.string().min(1, "UOM is required"),
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
  }),
});

export const updateProductionOrderSchema = z.object({
  body: productionOrderBodyShape
    .omit({ productionOrderId: true })
    .partial(),
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
      .refine((val) => val > 0 && val <= 1000, "Page size must be between 1 and 1000"),

    productItemId: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Number(val)), "Product Item ID must be a valid number"),

    productionOrderId: z
      .string()
      .max(20, "Production Order ID must be less than 20 characters")
      .optional(),

    sourceSalesOrderId: z
      .string()
      .optional(),

    status: z.string().optional(),

    search: z.string().optional(),

    fromDate: z
      .string()
      .datetime({ message: "Invalid from date format" })
      .optional()
      .refine((val) => val ? !isNaN(Date.parse(val)) : true, "Invalid from date"),

    toDate: z
      .string()
      .datetime({ message: "Invalid to date format" })
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
