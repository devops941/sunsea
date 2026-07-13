import { z } from "zod";

const ItemSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    description: z.string().min(1, "Description is required"),
    uom: z.string().min(1, "UOM is required"),
    quantity: z.coerce.number().min(0.001, "Qty must be > 0"),
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

export const CreateGrnInvoiceSchema = z.object({
    poId: z.preprocess(
        (val) => (val === "" || val === "null" || val === "undefined" ? null : val),
        z.string().uuid("Invalid PO ID").optional().nullable()
    ),
    invoiceNo: z.string().min(1, "Invoice number is required"),
    grnDate: z.string().min(1, "GRN Date is required"),
    supplierId: z.coerce.number().min(1, "Supplier is required"),
    storeId: z.string().min(1, "Store is required"),
    billingAddressLine1: z.string().min(1, "Billing Address Line 1 is required"),
    billingCity: z.string().min(1, "Billing City is required"),
    billingState: z.string().min(1, "Billing State is required"),
    billingPincode: z.string().min(1, "Billing Pincode is required"),

    shippingAddressLine1: z.string().min(1, "Shipping Address Line 1 is required"),
    shippingCity: z.string().min(1, "Shipping City is required"),
    shippingState: z.string().min(1, "Shipping State is required"),
    shippingPincode: z.string().min(1, "Shipping Pincode is required"),
    sameAsBilling: z.preprocess(
        (val) => val === "true" || val === true,
        z.boolean().optional()
    ),
    updateStock: z.preprocess(
        (val) => val === "true" || val === true,
        z.boolean().optional()
    ),
    
    receiveDate: z.preprocess((val) => (val === "" || val === "null" ? null : val), z.string().optional().nullable()),
    billDueDate: z.preprocess((val) => (val === "" || val === "null" ? null : val), z.string().optional().nullable()),
    challanNo: z.string().optional().nullable(),
    transport: z.string().optional().nullable(),
    eWayBill: z.string().optional().nullable(),
    invoiceImage: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    
    discountType: z.enum(["PERCENT", "FLAT"]).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    roundingAdjust: z.coerce.number().optional(),
    
    paymentStatus: z.string().optional(),
    paymentMethod: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    paymentDate: z.preprocess((val) => (val === "" || val === "null" ? null : val), z.string().optional().nullable()),
    
    items: z.preprocess((value) => {
        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    }, z.array(ItemSchema).min(1, "At least one item is required")),
});

export const UpdateGrnInvoiceSchema = CreateGrnInvoiceSchema.partial();

export const GrnInvoiceIdSchema = z.object({
    id: z.string().uuid("Invalid GRN Invoice ID"),
});

// Request-level schemas
export const createGrnInvoiceRequestSchema = z.object({
    body: CreateGrnInvoiceSchema,
});

export const updateGrnInvoiceRequestSchema = z.object({
    params: GrnInvoiceIdSchema,
    body: UpdateGrnInvoiceSchema,
});

export const grnInvoiceIdRequestSchema = z.object({
    params: GrnInvoiceIdSchema,
});

export type CreateGrnInvoiceInput = z.infer<typeof CreateGrnInvoiceSchema>;
export type UpdateGrnInvoiceInput = z.infer<typeof UpdateGrnInvoiceSchema>;
