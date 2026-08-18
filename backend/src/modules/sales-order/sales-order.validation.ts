import { z } from "zod";

export const ApprovalStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const DispatchTypeEnum = z.enum(["priority", "standard"]);
export type DispatchType = z.infer<typeof DispatchTypeEnum>;

export const OrderTypeEnum = z.enum(["telephone", "website", "salesperson", "reference"]);
export type OrderType = z.infer<typeof OrderTypeEnum>;

/**
 * Sales Order Workflow Status Enum (mirrors Prisma's SalesOrderStatus)
 */
export const SalesOrderStatusEnum = z.enum([
    "DRAFT",
    "PENDING_MD_APPROVAL",
    "MD_APPROVED",
    "MD_REJECTED",
    "PENDING_CUSTOMER_APPROVAL",
    "CUSTOMER_APPROVED",
    "CUSTOMER_REJECTED",
    "CONFIRMED",
    "QUOTATION_IN_PROGRESS",
    "QUOTATION_COMPLETED",
    "COMPLETED",
    "CANCELLED",
    "IN_PRODUCTION",
    "PLANNED",
    "MATERIAL_PENDING",
    "MATERIAL_RESERVED",
    "MATERIAL_ISSUED",
    "SCHEDULED",
    "IN_PROGRESS",
    "ON_HOLD",
    "FG_RECEIVED",
    "READY_FOR_DISPATCH",
    "PARTIALLY_DISPATCHED",
    "DISPATCHED",
]);
export type SalesOrderStatus = z.infer<typeof SalesOrderStatusEnum>;

const parseStatuses = (val: unknown): SalesOrderStatus[] | undefined => {
    if (!val) return undefined;
    let list: string[] = [];
    if (Array.isArray(val)) {
        list = val.map((s) => String(s).trim().toUpperCase());
    } else if (typeof val === "string") {
        list = val.split(",").map((s) => s.trim().toUpperCase());
    }
    const valid = list.filter((s) => SalesOrderStatusEnum.options.includes(s as any));
    return valid.length > 0 ? (valid as SalesOrderStatus[]) : undefined;
};

/**
 * Discount Type Enum (mirrors Prisma's DiscountType)
 */
export const DiscountTypeEnum = z.enum(["PERCENT", "FLAT"]);
export type DiscountType = z.infer<typeof DiscountTypeEnum>;

/**
 * Address Schema (reusable)
 */
export const addressSchema = z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
}).passthrough();
export type Address = z.infer<typeof addressSchema>;

/**
 * Sales Order Item Input (shared shape used inside create/update body)
 * Includes optional GST fields — only used when the role has sales-orders.view-gst permission.
 */
const salesOrderItemInputSchema = z.object({
    productId: z.union([z.string(), z.number()])
        .refine((val) => !isNaN(Number(val)), "Product ID must be a valid number"),
    quantity: z.union([z.number(), z.string()])
        .transform(Number)
        .refine((val) => Number.isFinite(val) && val > 0, "Quantity must be a valid positive number"),
    // Manually entered unit price (overrides grade-based pricing when present)
    unitPrice: z.union([z.number(), z.string()]).optional().nullable()
        .transform((val) => (val != null && val !== "" && !isNaN(Number(val)) && Number(val) > 0 ? Number(val) : undefined)),
    // GST fields (optional — stored in sales_order_items)
    gstTaxRateId: z.string().uuid("GST Tax Rate ID must be a valid UUID").optional().nullable(),
    cgstRate: z.number().min(0).max(100).optional().nullable(),
    sgstRate: z.number().min(0).max(100).optional().nullable(),
    igstRate: z.number().min(0).max(100).optional().nullable(),
});

/**
 * Estimated item input — one estimated rate per product.
 * Stored encrypted in the auxiliary table.
 */
const estimatedItemInputSchema = z.object({
    productId: z.union([z.string(), z.number()])
        .refine((val) => !isNaN(Number(val)), "Product ID must be a valid number"),
    estimatedRate: z.union([z.number(), z.string()]).transform(Number).refine((val) => Number.isFinite(val) && val > 0, "Estimated rate must be positive"),
    estimatedQuantity: z.union([z.number(), z.string()]).optional().nullable().transform((val) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : undefined)),
});

export type EstimatedItemInput = z.infer<typeof estimatedItemInputSchema>;

/**
 * Create Sales Order Validation
 */

const salesOrderBodyShape = z.object({
    orderNo: z.string().min(1, "Order number is required").max(30, "..."),
    orderDate: z.string().min(1, "Order date is required")
        .refine((val) => !isNaN(Date.parse(val)), "Invalid order date"),
    customerId: z.string().uuid("Customer ID must be a valid UUID"),
    mobile: z.string().optional().nullable().transform((val) => (val && val.trim() !== "" ? val : null)),
    isInterState: z.boolean().default(false).optional(),
    orderType: z.union([OrderTypeEnum, z.literal(""), z.null()]).optional().transform((val) => (val && val.trim() !== "" ? (val as any) : undefined)),
    referenceText: z.string().optional().nullable().transform((val) => (val && val.trim() !== "" ? val : null)),
    salesPersonName: z.string().optional().nullable().transform((val) => (val && val.trim() !== "" ? val : null)),
    status: SalesOrderStatusEnum.default("DRAFT"),
    narration: z.string().max(1000, "Narration must be less than 1000 characters").optional().nullable(),
    createdBy: z.string().min(1).max(36).optional().nullable(),
    // Order-level discount (from the quotation form)
    orderDiscountType: DiscountTypeEnum.optional().nullable(),
    orderDiscountValue: z.coerce.number().min(0).optional().nullable(),
    items: z.array(salesOrderItemInputSchema).min(1, "At least one item is required"),
    // Estimated pricing section — encrypted at rest, restricted by sales-orders.view-estimate permission
    estimatedItems: z.array(estimatedItemInputSchema).optional().nullable(),
    estimatedNarration: z.string().max(1000).optional().nullable(),
});

const salesOrderBodyRefined = salesOrderBodyShape.superRefine((data, ctx) => {
    if (data.orderType === "salesperson" && !data.salesPersonName) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sales person name is required when order source is Sales Person",
            path: ["salesPersonName"],
        });
    }
    if (data.orderType === "reference" && !data.referenceText) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Reference text is required when order source is Reference",
            path: ["referenceText"],
        });
    }

    // Reject duplicate (productId) pairs at the validation layer too,
    // so the client gets a field-level Zod error before it even hits the service.
    const seen = new Map<string, number>();
    data.items.forEach((item, index) => {
        const key = `${item.productId}`;
        if (seen.has(key)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate item: productId=${item.productId}`,
                path: ["items", index, "productId"],
            });
            // also flag the original occurrence
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate item: productId=${item.productId}`,
                path: ["items", seen.get(key)!, "productId"],
            });
        } else {
            seen.set(key, index);
        }
    });
});

export const createSalesOrderSchema = z.object({
    body: salesOrderBodyRefined,
});

/**
 * Update Sales Order Validation
 */
export const updateSalesOrderSchema = z.object({
    body: salesOrderBodyShape          // ← raw shape, no superRefine
        .omit({ orderNo: true, orderDate: true, customerId: true })
        .partial()
        // Remove the .default("DRAFT") from status so an absent status stays
        // undefined — preventing the update from silently resetting the order
        // status back to DRAFT when only items/discount are being changed.
        .extend({ status: SalesOrderStatusEnum.optional() }),
    params: z.object({
        id: z.string().or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    }),
});

/**
 * Sales Order ID Validation
 */
export const salesOrderIdSchema = z.object({
    params: z.object({
        id: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    })
});

/**
 * Sales Order Query Filters
 */
export const salesOrderQuerySchema = z.object({
    query: z.object({
        // Pagination
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
            .refine((val) => val > 0 && val <= 100, "Page size must be between 1 and 100"),

        // Filters
        customerId: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        orderNo: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        status: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .transform(parseStatuses),

        orderType: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        search: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        fromDate: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        toDate: z
            .string()
            .optional()
            .transform((val) => (val && val.trim() !== "" ? val : undefined)),

        // Sorting
        sortBy: z
            .string()
            .optional()
            .transform((val) => (val && ["orderDate", "createdAt", "orderNo"].includes(val) ? (val as any) : "createdAt")),

        sortOrder: z
            .string()
            .optional()
            .transform((val) => (val && ["asc", "desc"].includes(val.toLowerCase()) ? (val.toLowerCase() as any) : "desc")),
    })
});

/**
 * Sales Order Item Validation
 */
export const createSalesOrderItemSchema = z.object({
    body: z.object({
        salesOrderId: z
            .number()
            .int()
            .positive("Sales order ID must be a positive integer"),

        productId: z
            .union([z.string(), z.number()])
            .refine((val) => !isNaN(Number(val)), "Product ID must be a valid number"),

        quantity: z
            .number()
            .positive("Quantity must be positive")
            .refine(
                (val) => Number.isFinite(val) && val > 0,
                "Quantity must be a valid positive number"
            ),

        gstTaxRateId: z.string().uuid("GST Tax Rate ID must be a valid UUID").optional().nullable(),
    })
});

export const updateSalesOrderItemSchema = z.object({
    body: createSalesOrderItemSchema.shape.body
        .omit({ salesOrderId: true })
        .partial(),
    params: z.object({
        itemId: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Item ID must be a valid number"),
        salesOrderId: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    })
});

/**
 * Bulk Create Sales Order Items
 */
export const bulkCreateSalesOrderItemsSchema = z.object({
    body: z.object({
        salesOrderId: z
            .number()
            .int()
            .positive("Sales order ID must be a positive integer"),

        items: z
            .array(salesOrderItemInputSchema)
            .min(1, "At least one item is required"),
    })
});


/**
 * Submit For MD Approval Validation
 * No body needed — just moves status DRAFT -> PENDING_MD_APPROVAL
 */
export const submitForMdApprovalSchema = z.object({
    params: z.object({
        id: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    }),
});

/**
 * Reopen Sales Order Validation
 * Resets a rejected order back to DRAFT so it can be edited and resubmitted.
 * No body needed — params only.
 */
export const reopenSalesOrderSchema = z.object({
    params: z.object({
        id: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    }),
});

// ============================================
// Type Exports
// ============================================

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>["body"];
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>["body"];
export type SalesOrderQueryInput = z.infer<typeof salesOrderQuerySchema>["query"];
export type CreateSalesOrderItemInput = z.infer<typeof createSalesOrderItemSchema>["body"];
export type UpdateSalesOrderItemInput = z.infer<typeof updateSalesOrderItemSchema>["body"];
export type BulkCreateSalesOrderItemsInput = z.infer<typeof bulkCreateSalesOrderItemsSchema>["body"];