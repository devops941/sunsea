import { z } from "zod";
import type { PurchaseOrderFormData } from "../../../../features/purchaseOrder/types";

const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  uom: z.string().min(1, "UOM is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  tax: z.number().min(0).max(100, "Tax must be between 0 and 100"),
});

export const purchaseOrderSchema = z.object({
  poDate: z.string().min(1, "PO Date is required"),
  supplierId: z.union([z.string().min(1), z.number().min(1)], {
    message: "Supplier is required",
  }),
  storeId: z.string().min(1, "Store is required"),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
});

export const validatePurchaseOrder = (data: PurchaseOrderFormData): Record<string, string> => {
  const result = purchaseOrderSchema.safeParse({
    poDate: data.poDate,
    supplierId: data.supplierId,
    storeId: data.storeId,
    items: data.items.map((item) => ({
      productId: item.productId,
      uom: item.uom,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      tax: Number(item.tax),
    })),
  });

  if (result.success) return {};

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });

  return errors;
};
