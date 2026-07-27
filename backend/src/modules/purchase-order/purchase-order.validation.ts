import { z } from "zod";

const AddressSchema = z.object({
    addressLine1: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().min(1, "Pincode is required"),
});

const ItemSchema = z.object({
    productId: z.union([z.string(), z.number()]),
    uom: z.string().min(1, "UOM is required"),
    quantity: z.coerce.number().min(0.01, "Qty must be > 0"),
    unitPrice: z.coerce.number().min(0, "Price must be ≥ 0"),
    tax: z.coerce.number().min(0).max(100).optional(),
    taxableAmount: z.coerce.number().min(0).optional(),
    cgstRate: z.coerce.number().min(0).optional(),
    cgstAmount: z.coerce.number().min(0).optional(),
    sgstRate: z.coerce.number().min(0).optional(),
    sgstAmount: z.coerce.number().min(0).optional(),
    igstRate: z.coerce.number().min(0).optional(),
    igstAmount: z.coerce.number().min(0).optional(),
});

export const CreatePurchaseOrderSchema = z.object({
    poDate: z.string().min(1, "PO Date is required"),
    expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
    supplierId: z.coerce.number().min(1, "Supplier is required"),
    billingAddressLine1: z.string().min(1, "Billing Address Line 1 is required"),
    billingCity: z.string().min(1, "Billing City is required"),
    billingState: z.string().min(1, "Billing State is required"),
    billingPincode: z.string().min(1, "Billing Pincode is required"),
    billingCountry: z.string().optional().nullable(),

    shippingAddressLine1: z.string().min(1, "Shipping Address Line 1 is required"),
    shippingCity: z.string().min(1, "Shipping City is required"),
    shippingState: z.string().min(1, "Shipping State is required"),
    shippingPincode: z.string().min(1, "Shipping Pincode is required"),
    shippingCountry: z.string().optional().nullable(),
    sameAsBilling: z.boolean().optional(),
    storeId: z.string().optional(),
    discountType: z.enum(["PERCENT", "FLAT"]).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    roundingAdjust: z.coerce.number().optional(),
    remarks: z.string().optional(),
    items: z.array(ItemSchema).min(1, "At least one item is required"),
    status: z.string().optional(),
});

export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema.partial().extend({
    status: z.string().optional(),
    rejectReason: z.string().optional(),
});

export const PurchaseOrderIdSchema = z.object({
    id: z.string().uuid("Invalid Purchase Order ID"),
});

// ── Request-level schemas (params + body) ─────────────────────────────────
export const createPurchaseOrderRequestSchema = z.object({
    body: CreatePurchaseOrderSchema,
});

export const updatePurchaseOrderRequestSchema = z.object({
    params: PurchaseOrderIdSchema,
    body: UpdatePurchaseOrderSchema,
});

export const purchaseOrderIdRequestSchema = z.object({
    params: PurchaseOrderIdSchema,
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;