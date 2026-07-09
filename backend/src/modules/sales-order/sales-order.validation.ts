import { z } from "zod";

/**
 * Sales Order Approval Status Enum
 */

const parseStatuses = (val: unknown) => {
    if (!val || typeof val !== "string") return undefined;
    const raw = val.split(",").map((s) => s.trim().toUpperCase());
    const parsed = raw.map((s) => {
        const result = SalesOrderStatusEnum.safeParse(s);
        return result.success ? result.data : null;
    });
    const filtered = parsed.filter(Boolean) as SalesOrderStatus[];
    return filtered.length > 0 ? filtered : undefined;
};

export const ApprovalStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const DispatchTypeEnum = z.enum(["priority", "standard"]);
export type DispatchType = z.infer<typeof DispatchTypeEnum>;

export const OrderTypeEnum = z.enum(["telephone", "website", "salesperson"]);
export type OrderType = z.infer<typeof OrderTypeEnum>;

export const CustomerTypeEnum = z.enum(["B2B", "B2C", "EXPORT"]);
export type CustomerType = z.infer<typeof CustomerTypeEnum>;

/**
 * Color Type Enum (mirrors "sc" | "mc" used on SalesOrderItem.colorType)
 */
export const ColorTypeEnum = z.enum(["sc", "mc"]);
export type ColorType = z.infer<typeof ColorTypeEnum>;

/**
 * Sales Order Workflow Status Enum (mirrors Prisma's SalesOrderStatus)
 */
export const SalesOrderStatusEnum = z.enum([
    "DRAFT",
    "CONFIRMED",
    "QUOTATION_IN_PROGRESS",
    "QUOTATION_COMPLETED",
    "PENDING_MD_APPROVAL",
    "MD_APPROVED",
    "MD_REJECTED",
    "PENDING_CUSTOMER_APPROVAL",
    "CUSTOMER_APPROVED",
    "CUSTOMER_REJECTED",
    "COMPLETED",
    "CANCELLED",
    "IN_PRODUCTION",
    "PLANNED",
    "MATERIAL_PENDING",
    "MATERIAL_RESERVED",
    "MATERIAL_ISSUED",
    "SCHEDULED",
    "IN_PROGRESS",
]);
export type SalesOrderStatus = z.infer<typeof SalesOrderStatusEnum>;

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
 */
const salesOrderItemInputSchema = z.object({
    productId: z.union([z.string(), z.number()])
        .refine((val) => !isNaN(Number(val)), "Product ID must be a valid number"),
    quantity: z.number().positive("Quantity must be positive")
        .refine((val) => Number.isFinite(val) && val > 0, "Quantity must be a valid positive number"),
    colorTypeId: ColorTypeEnum, // ← added — "sc" | "mc", required
    gstTaxRateId: z.string().uuid("GST Tax Rate ID must be a valid UUID").optional().nullable(),
});

/**
 * Create Sales Order Validation
 */

const salesOrderBodyShape = z.object({
    orderNo: z.string().min(1, "Order number is required").max(30, "..."),
    orderDate: z.string().datetime({ message: "Invalid order date format" })
        .refine((val) => !isNaN(Date.parse(val)), "Invalid order date"),
    expectedCompletionDate: z.string().datetime({ message: "Invalid completion date format" })
        .refine((val) => !isNaN(Date.parse(val)), "Invalid completion date")
        .refine((val) => new Date(val) > new Date(), "Expected completion date must be in the future"),
    customerId: z.string().uuid("Customer ID must be a valid UUID"),
    customerType: CustomerTypeEnum,   // ← add this
    isInterState: z.boolean().default(false).optional(),
    paymentTermId: z.number().int().positive("...").optional().nullable(),
    dispatchType: z.union([DispatchTypeEnum, z.literal("")]).optional().transform(val => val === "" ? undefined : val),
    orderType: z.union([OrderTypeEnum, z.literal("")]).optional().transform(val => val === "" ? undefined : val),
    salesPersonId: z.union([z.string(), z.number()])          // ← also missing entirely
        .optional().nullable()
        .refine((val) => val === null || val === undefined || !isNaN(Number(val)), "Sales person ID must be a valid number"),
    status: SalesOrderStatusEnum.default("DRAFT"),
    billingAddressLine1: z.string().min(1, "Billing Address Line 1 is required"),
    billingCity: z.string().min(1, "Billing City is required"),
    billingState: z.string().min(1, "Billing State is required"),
    billingPincode: z.string().min(1, "Billing Pincode is required"),

    shippingAddressLine1: z.string().optional().nullable(),
    shippingCity: z.string().optional().nullable(),
    shippingState: z.string().optional().nullable(),
    shippingPincode: z.string().optional().nullable(),
    sameAsBilling: z.boolean().default(false).optional(),
    remarks: z.string().max(500, "Remarks must be less than 500 characters").optional().nullable(),
    internalNotes: z.string().max(1000, "Internal notes must be less than 1000 characters").optional().nullable(),
    mdApprovalStatus: ApprovalStatusEnum.default("PENDING").optional(),
    mdApprovedBy: z.string().min(1).max(36).optional().nullable(),
    mdApprovedAt: z.string().datetime({ message: "Invalid approval date format" }).optional().nullable(),
    mdRejectionReason: z.string().max(500).optional().nullable(),
    customerApprovalStatus: ApprovalStatusEnum.default("PENDING").optional(),
    customerApprovedAt: z.string().datetime({ message: "Invalid customer approval date format" }).optional().nullable(),
    customerRejectionReason: z.string().max(500).optional().nullable(),
    createdBy: z.string().min(1).max(36).optional().nullable(),
    items: z.array(salesOrderItemInputSchema).min(1, "At least one item is required"),
});

const salesOrderBodyRefined = salesOrderBodyShape.superRefine((data, ctx) => {
    if (data.expectedCompletionDate && data.orderDate) {
        if (new Date(data.expectedCompletionDate) < new Date(data.orderDate)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected completion date must be after order date", path: ["expectedCompletionDate"] });
        }
    }
    if (data.sameAsBilling === false && !data.shippingAddressLine1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shipping address is required when not same as billing", path: ["shippingAddressLine1"] });
    }
    if (data.mdApprovalStatus === "APPROVED") {
        if (!data.mdApprovedBy) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Approved by is required when status is APPROVED", path: ["mdApprovedBy"] });
        if (!data.mdApprovedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Approved at is required when status is APPROVED", path: ["mdApprovedAt"] });
    }
    if (data.mdApprovalStatus === "REJECTED" && !data.mdRejectionReason) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rejection reason is required when status is REJECTED", path: ["mdRejectionReason"] });
    }
    if (data.customerApprovalStatus === "APPROVED" && !data.customerApprovedAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer approved at is required when status is APPROVED", path: ["customerApprovedAt"] });
    }
    if (data.orderType === "salesperson" && !data.salesPersonId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sales person is required when order source is Sales Person",
            path: ["salesPersonId"],
        });
    }
    if (data.customerApprovalStatus === "REJECTED" && !data.customerRejectionReason) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer rejection reason is required when status is REJECTED", path: ["customerRejectionReason"] });
    }

    // Reject duplicate (productId + colorTypeId) pairs at the validation layer too,
    // so the client gets a field-level Zod error before it even hits the service.
    const seen = new Map<string, number>();
    data.items.forEach((item, index) => {
        const key = `${item.productId}::${item.colorTypeId}`;
        if (seen.has(key)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate item: productId=${item.productId}, colorType=${item.colorTypeId}`,
                path: ["items", index, "colorTypeId"],
            });
            // also flag the original occurrence
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate item: productId=${item.productId}, colorType=${item.colorTypeId}`,
                path: ["items", seen.get(key)!, "colorTypeId"],
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
        .partial(),
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
            .uuid("Customer ID must be a valid UUID")
            .optional(),

        orderNo: z
            .string()
            .max(30, "Order number must be less than 30 characters")
            .optional(),

        status: z
            .string()
            .optional()
            .transform(parseStatuses),

        mdApprovalStatus: ApprovalStatusEnum.optional(),
        dispatchType: DispatchTypeEnum.optional(),
        orderType: OrderTypeEnum.optional(),

        customerApprovalStatus: ApprovalStatusEnum.optional(),

        search: z
            .string()
            .optional(),

        fromDate: z
            .string()
            .date({ message: "Invalid from date format" })
            .optional()
            .refine((val) => val ? !isNaN(Date.parse(val)) : true, "Invalid from date"),

        toDate: z
            .string()
            .date({ message: "Invalid to date format" })
            .optional()
            .refine((val) => val ? !isNaN(Date.parse(val)) : true, "Invalid to date"),

        // Sorting
        sortBy: z
            .enum(["orderDate", "createdAt", "orderNo", "expectedCompletionDate"])
            .optional()
            .default("createdAt"),

        sortOrder: z
            .enum(["asc", "desc"])
            .optional()
            .default("desc"),
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

        colorTypeId: ColorTypeEnum, // ← added
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
 * Update Discounts Validation
 * Body: array of { itemId, discountType, discountValue }
 * Every item belonging to the order should be included; items omitted
 * are NOT reset — only items present in the array are updated.
 */
export const updateSalesOrderDiscountsSchema = z.object({
    params: z.object({
        id: z
            .string()
            .or(z.number())
            .refine((val) => !isNaN(Number(val)), "Sales order ID must be a valid number"),
    }),
    body: z.object({
        items: z
            .array(
                z.object({
                    itemId: z
                        .union([z.string(), z.number()])
                        .refine((val) => !isNaN(Number(val)), "Item ID must be a valid number"),
                    discountType: DiscountTypeEnum,
                    discountValue: z
                        .number()
                        .min(0, "Discount value cannot be negative"),
                })
            )
            .min(1, "At least one item discount is required"),
    }).superRefine((data, ctx) => {
        data.items.forEach((item, idx) => {
            if (item.discountType === "PERCENT" && item.discountValue > 100) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Percent discount cannot exceed 100",
                    path: ["items", idx, "discountValue"],
                });
            }
        });
    }),
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

/**
 * Approval Decision Schemas
 */
export const mdApprovalDecisionSchema = z.object({
    body: z.object({
        decision: z.enum(["APPROVED", "REJECTED"], {
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "Decision is required" };
                }
                return { message: "Decision must be APPROVED or REJECTED" };
            }
        }),
        approverId: z
            .string()
            .min(1, "Approver ID is required")
            .max(36, "Approver ID must be less than 36 characters"),
        rejectionReason: z
            .string()
            .max(500, "Rejection reason must be less than 500 characters")
            .optional()
            .nullable(),
    }).superRefine((data, ctx) => {
        if (data.decision === "REJECTED" && !data.rejectionReason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Rejection reason is required when decision is REJECTED",
                path: ["rejectionReason"],
            });
        }
    }),
});

export const customerApprovalDecisionSchema = z.object({
    body: z.object({
        decision: z.enum(["APPROVED", "REJECTED"], {
            error: (issue) => {
                if (issue.input === undefined) {
                    return { message: "Decision is required" };
                }
                return { message: "Decision must be APPROVED or REJECTED" };
            }
        }),
        rejectionReason: z
            .string()
            .max(500, "Rejection reason must be less than 500 characters")
            .optional()
            .nullable(),
    }).superRefine((data, ctx) => {
        if (data.decision === "REJECTED" && !data.rejectionReason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Rejection reason is required when decision is REJECTED",
                path: ["rejectionReason"],
            });
        }
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
export type UpdateSalesOrderDiscountsInput = z.infer<typeof updateSalesOrderDiscountsSchema>["body"];
export type MdApprovalDecisionInput = z.infer<typeof mdApprovalDecisionSchema>["body"];
export type CustomerApprovalDecisionInput = z.infer<typeof customerApprovalDecisionSchema>["body"];