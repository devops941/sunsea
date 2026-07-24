import { z } from "zod";

export const WastageTypeEnum = z.enum([
  "STARTUP",
  "MACHINE_SETUP",
  "QUALITY_REJECTION",
  "RAW_MATERIAL_WASTE",
  "SCRAP",
  "REWORK",
  "MACHINE_BREAKDOWN",
  "POWER_FAILURE",
  "MOULD_CHANGE",
  "COLOR_CHANGE",
  "OTHER"
]);

export const WastageStatusEnum = z.enum([
  "DRAFT",
  "APPROVED",
  "REJECTED"
]);

export const createProductionWastageSchema = z.object({
  body: z.object({
    wastageDate: z.string().min(1, "Wastage Date is required"),
    productionOrderId: z.string().min(1, "Production Order ID is required").max(20),
    hourlyProductionId: z.number().int().optional().nullable(),
    machineId: z.string().min(1, "Machine ID is required").max(20),
    shiftId: z.string().min(1, "Shift ID is required").max(20),
    productId: z.number().int().min(1, "Product ID is required"),
    rawMaterialId: z.string().max(20).optional().nullable(),
    targetWastageProductId: z.string().max(20).optional().nullable(),
    wastageType: WastageTypeEnum,
    quantity: z.number().positive("Quantity must be greater than 0"),
    uom: z.string().min(1, "UOM is required").max(10),
    estimatedValue: z.number().nonnegative().optional().nullable(),
    reason: z.string().max(255).optional().nullable(),
    correctiveAction: z.string().max(255).optional().nullable(),
    remarks: z.string().max(255).optional().nullable(),
    isRecyclable: z.boolean().optional().default(false),
    sentForRework: z.boolean().optional().default(false),
    status: WastageStatusEnum.optional().default("DRAFT"),
  }),
});

export const updateProductionWastageSchema = z.object({
  body: createProductionWastageSchema.shape.body.partial(),
  params: z.object({
    id: z.string().regex(/^\d+$/, "Wastage ID must be a numeric string"),
  }),
});

export const getProductionWastageIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Wastage ID must be a numeric string"),
  }),
});

export type CreateProductionWastageInput = z.infer<typeof createProductionWastageSchema>["body"];
export type UpdateProductionWastageInput = z.infer<typeof updateProductionWastageSchema>["body"];
