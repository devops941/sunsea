import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import creditCheckService from "./creditCheckService";
import {
    CreateSalesOrderInput,
    UpdateSalesOrderInput,
    SalesOrderQueryInput,
    MdApprovalDecisionInput,
    CustomerApprovalDecisionInput,
    UpdateSalesOrderDiscountsInput,
    SalesOrderStatus
} from "./sales-order.validation";

// ─── Type Definitions ──────────────────────────────────────────────────

type ProductPricingRow = {
    id: bigint;
    b2b: Prisma.Decimal | null;
    mrp: Prisma.Decimal | null;
    b2c: Prisma.Decimal | null;
    exportPrice: Prisma.Decimal | null;
    gstTaxRateId: string | null;
    gstRate: Prisma.Decimal | null;
};

type LineCalculation = {
    productId: bigint;
    quantity: Prisma.Decimal;
    b2b: Prisma.Decimal | null;
    mrp: Prisma.Decimal | null;
    b2c: Prisma.Decimal | null;
    exportPrice: Prisma.Decimal | null;
    lineSubtotal: Prisma.Decimal;
    discountType: "PERCENT" | "FLAT";
    discountValue: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxableValue: Prisma.Decimal; // stored as taxableAmount in DB
    cgstRate: Prisma.Decimal;
    cgstAmount: Prisma.Decimal;
    sgstRate: Prisma.Decimal;
    sgstAmount: Prisma.Decimal;
    igstRate: Prisma.Decimal;
    igstAmount: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    gstTaxRateId: string | null;
};

type IncomingItem = {
    productId: string | number | bigint;
    quantity: number | string;
};

const BASE_PRICE_KEY = "__base__";

// ─── Service Implementation ──────────────────────────────────────────

class SalesOrderService {

    // ─── Internal helpers ──────────────────────────────────────────────

    private async assertProductsExist(productIds: bigint[]) {
        if (productIds.length === 0) {
            throw new ApiError(400, "No product IDs provided");
        }

        const uniqueProductIds = [...new Set(productIds.map((id) => id.toString()))];
        const found = await prisma.product.findMany({
            where: {
                id: { in: uniqueProductIds.map((id) => BigInt(id)) },
                isActive: true
            },
            select: { id: true },
        });

        if (found.length !== uniqueProductIds.length) {
            const foundIds = new Set(found.map((f) => f.id.toString()));
            const missing = uniqueProductIds.filter((id) => !foundIds.has(id));
            throw new ApiError(404, `Product(s) not found or inactive: ${missing.join(", ")}`);
        }
    }

    private assertNoDuplicateProducts(items: IncomingItem[]) {
        const seenAt = new Map<string, number>();
        const duplicateIndexes = new Set<number>();
        const duplicatePairs = new Set<string>();

        items.forEach((item, index) => {
            const key = `${item.productId.toString()}`;
            if (seenAt.has(key)) {
                duplicateIndexes.add(seenAt.get(key)!);
                duplicateIndexes.add(index);
                duplicatePairs.add(key);
            } else {
                seenAt.set(key, index);
            }
        });

        if (duplicateIndexes.size > 0) {
            const readable = [...duplicatePairs].map((key) => {
                return `productId=${key}`;
            });
            throw new ApiError(400, `Duplicate item(s) found: ${readable.join(" | ")}`);
        }
    }

    private async getProductPricingMap(
        items: { productId: bigint; gstTaxRateId?: string | null }[]
    ): Promise<Map<string, ProductPricingRow>> {
        const uniqueProductIds = [...new Set(items.map((i) => i.productId.toString()))]
            .map((id) => BigInt(id));

        const products = await prisma.product.findMany({
            where: { id: { in: uniqueProductIds } },
            select: {
                id: true,
                gstRate: true,
                gstTaxRateId: true,
                b2b: true,
                mrp: true,
                b2c: true,
                exportPrice: true,
            },
        });

        // Resolve GST tax rates
        const allGstTaxRateIds = new Set<string>();
        for (const p of products) {
            if (p.gstTaxRateId) allGstTaxRateIds.add(p.gstTaxRateId);
        }
        for (const item of items) {
            if (item.gstTaxRateId) allGstTaxRateIds.add(item.gstTaxRateId);
        }
        const gstTaxRates = await prisma.gstTaxRate.findMany({
            where: { id: { in: Array.from(allGstTaxRateIds) } },
            select: { id: true, taxRate: true }
        });
        const gstTaxRateMap = new Map(gstTaxRates.map((r) => [r.id, r.taxRate]));

        const map = new Map<string, ProductPricingRow>();

        for (const p of products) {
            const defaultTaxRate = p.gstTaxRateId ? gstTaxRateMap.get(p.gstTaxRateId) : null;
            const resolvedGstRate = defaultTaxRate !== undefined && defaultTaxRate !== null
                ? defaultTaxRate
                : (p.gstRate ? new Prisma.Decimal(p.gstRate) : null);

            const baseRow: ProductPricingRow = {
                id: p.id,
                gstTaxRateId: p.gstTaxRateId,
                gstRate: resolvedGstRate,
                b2b: p.b2b,
                mrp: p.mrp,
                b2c: p.b2c,
                exportPrice: p.exportPrice,
            };
            map.set(`${p.id.toString()}`, baseRow);
        }
        return map;
    }

    private resolvePricing(
        map: Map<string, ProductPricingRow>,
        productId: bigint
    ): ProductPricingRow | undefined {
        return map.get(`${productId.toString()}`);
    }

    private resolveUnitPrice(
        customerType: string | null | undefined,
        pricing: { b2b: Prisma.Decimal | null; mrp: Prisma.Decimal | null; b2c: Prisma.Decimal | null; exportPrice: Prisma.Decimal | null }
    ): Prisma.Decimal {
        switch (customerType) {
            case "B2C":
                return pricing.b2c ?? pricing.mrp ?? pricing.b2b ?? pricing.exportPrice ?? new Prisma.Decimal(0);
            case "EXPORT":
                return pricing.exportPrice ?? pricing.mrp ?? pricing.b2b ?? pricing.b2c ?? new Prisma.Decimal(0);
            case "B2B":
            default:
                return pricing.b2b ?? pricing.mrp ?? pricing.b2c ?? pricing.exportPrice ?? new Prisma.Decimal(0);
        }
    }

    // ─── Core line calculator with GST split ─────────────────────────

    private calculateLine(params: {
        productId: bigint;
        quantity: Prisma.Decimal;
        pricing: ProductPricingRow;
        customerType?: string | null;
        discountType?: "PERCENT" | "FLAT";
        discountValue?: Prisma.Decimal;
        customGstTaxRateId?: string | null;
        customGstRate?: Prisma.Decimal | null;
        isInterState?: boolean;
    }): LineCalculation {
        const { productId, quantity, pricing, isInterState = false } = params;

        const unitPrice = this.resolveUnitPrice(params.customerType, pricing);
        const mrp = pricing.mrp;
        const b2b = pricing.b2b;
        const b2c = pricing.b2c;
        const exportPrice = pricing.exportPrice;

        const gstTaxRateId = params.customGstTaxRateId !== undefined ? params.customGstTaxRateId : pricing.gstTaxRateId;
        const totalGstRate = params.customGstRate !== undefined && params.customGstRate !== null
            ? params.customGstRate
            : (pricing.gstRate ?? new Prisma.Decimal(0));

        const lineSubtotal = quantity.mul(unitPrice);

        const discountType = params.discountType ?? "PERCENT";
        const discountValue = params.discountValue ?? new Prisma.Decimal(0);

        const rawDiscountAmount = discountType === "PERCENT"
            ? lineSubtotal.mul(discountValue).div(100)
            : discountValue;

        const discountAmount = rawDiscountAmount.gt(lineSubtotal) ? lineSubtotal : rawDiscountAmount;
        const taxableValue = lineSubtotal.sub(discountAmount);
        const totalGstAmount = taxableValue.mul(totalGstRate).div(100);

        // Split GST based on isInterState
        let cgstRate: Prisma.Decimal, sgstRate: Prisma.Decimal, igstRate: Prisma.Decimal;
        let cgstAmount: Prisma.Decimal, sgstAmount: Prisma.Decimal, igstAmount: Prisma.Decimal;

        if (isInterState) {
            igstRate = totalGstRate;
            cgstRate = new Prisma.Decimal(0);
            sgstRate = new Prisma.Decimal(0);
            igstAmount = totalGstAmount;
            cgstAmount = new Prisma.Decimal(0);
            sgstAmount = new Prisma.Decimal(0);
        } else {
            cgstRate = totalGstRate.div(2);
            sgstRate = totalGstRate.div(2);
            igstRate = new Prisma.Decimal(0);
            cgstAmount = totalGstAmount.div(2);
            sgstAmount = totalGstAmount.div(2);
            igstAmount = new Prisma.Decimal(0);
        }

        const lineTotal = taxableValue.add(totalGstAmount); // no cess in schema

        return {
            productId,
            quantity,
            b2b,
            mrp,
            b2c,
            exportPrice,
            lineSubtotal,
            discountType,
            discountValue,
            discountAmount,
            taxableValue,
            cgstRate,
            cgstAmount,
            sgstRate,
            sgstAmount,
            igstRate,
            igstAmount,
            lineTotal,
            gstTaxRateId,
        };
    }

    private calculateLinesWithOrderDiscount(
        items: Array<{
            productId: bigint;
            quantity: Prisma.Decimal;
            pricing: ProductPricingRow;
            gstTaxRateId?: string | null;
            customGstRate?: Prisma.Decimal | null;
        }>,
        customerType: string | null | undefined,
        isInterState: boolean,
        orderDiscountType: "PERCENT" | "FLAT",
        orderDiscountValue: Prisma.Decimal
    ): LineCalculation[] {
        const baseLines = items.map((item) => {
            return this.calculateLine({
                productId: item.productId,
                quantity: item.quantity,
                pricing: item.pricing,
                customerType,
                customGstTaxRateId: item.gstTaxRateId,
                customGstRate: item.customGstRate,
                isInterState,
                discountType: "PERCENT",
                discountValue: new Prisma.Decimal(0),
            });
        });

        const subtotal = baseLines.reduce((sum, line) => sum.add(line.lineSubtotal), new Prisma.Decimal(0));

        const rawDiscount = orderDiscountType === "PERCENT"
            ? subtotal.mul(orderDiscountValue).div(100)
            : orderDiscountValue;
        const totalDiscount = rawDiscount.gt(subtotal) ? subtotal : rawDiscount;

        return baseLines.map((baseLine, index) => {
            const share = subtotal.gt(0) ? baseLine.lineSubtotal.div(subtotal) : new Prisma.Decimal(0);
            const itemDiscount = totalDiscount.mul(share);
            const item = items[index];

            return this.calculateLine({
                productId: baseLine.productId,
                quantity: baseLine.quantity,
                pricing: item.pricing,
                customerType,
                customGstTaxRateId: item.gstTaxRateId,
                customGstRate: item.customGstRate,
                isInterState,
                discountType: "FLAT",
                discountValue: itemDiscount,
            });
        });
    }

    async create(data: CreateSalesOrderInput) {
        const blockResult = await creditCheckService.hasBlockingPendingOrder(data.customerId);
        if (blockResult.blocked && blockResult.blockingOrder) {
            throw new ApiError(409, `This customer has a pending credit approval (Order #${blockResult.blockingOrder.orderNo}). New orders are blocked until MD approves or rejects it.`);
        }

        if (!data.items || data.items.length === 0) {
            throw new ApiError(400, "At least one item is required");
        }

        this.assertNoDuplicateProducts(data.items);

        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
        });
        if (!customer) {
            throw new ApiError(404, `Customer with ID ${data.customerId} not found`);
        }

        const productIds = data.items.map((i) => BigInt(i.productId));
        await this.assertProductsExist(productIds);

        const existingOrderNo = await prisma.salesOrder.findUnique({
            where: { orderNo: data.orderNo },
        });
        if (existingOrderNo) {
            throw new ApiError(409, `Order No "${data.orderNo}" already exists`);
        }


        const isInterState = data.isInterState ?? false;

        const pricingMap = await this.getProductPricingMap(
            data.items.map((i) => ({ productId: BigInt(i.productId), gstTaxRateId: i.gstTaxRateId }))
        );

        const customGstTaxRateIds = new Set<string>();
        data.items.forEach((i) => {
            if (i.gstTaxRateId) customGstTaxRateIds.add(i.gstTaxRateId);
        });
        const customGstTaxRates = await prisma.gstTaxRate.findMany({
            where: { id: { in: Array.from(customGstTaxRateIds) } },
            select: { id: true, taxRate: true }
        });
        const customGstTaxRateMap = new Map(customGstTaxRates.map((r) => [r.id, r.taxRate]));

        const orderDiscountType = data.orderDiscountType ?? "PERCENT";
        const orderDiscountValue = data.orderDiscountValue !== undefined ? new Prisma.Decimal(data.orderDiscountValue) : new Prisma.Decimal(0);

        const lineCalcs = this.calculateLinesWithOrderDiscount(
            data.items.map((item) => {
                const productId = BigInt(item.productId);
                const pricing = this.resolvePricing(pricingMap, productId);
                if (!pricing) {
                    throw new ApiError(404, `Product with ID ${item.productId} not found`);
                }

                let customGstRate: Prisma.Decimal | null = null;
                if (item.gstTaxRateId) {
                    const rate = customGstTaxRateMap.get(item.gstTaxRateId);
                    if (rate === undefined) {
                        throw new ApiError(400, `GST Tax Rate with ID ${item.gstTaxRateId} not found`);
                    }
                    customGstRate = rate;
                }

                return {
                    productId,
                    quantity: new Prisma.Decimal(item.quantity),
                    pricing,
                    gstTaxRateId: item.gstTaxRateId,
                    customGstRate,
                };
            }),
            data.customerType,
            isInterState,
            orderDiscountType,
            orderDiscountValue
        );

        const orderTotals = lineCalcs.reduce(
            (acc, line) => ({
                subtotal: acc.subtotal.add(line.lineSubtotal),
                totalDiscount: acc.totalDiscount.add(line.discountAmount),
                totalCgst: acc.totalCgst.add(line.cgstAmount),
                totalSgst: acc.totalSgst.add(line.sgstAmount),
                totalIgst: acc.totalIgst.add(line.igstAmount),
                netAmount: acc.netAmount.add(line.lineTotal),
            }),
            {
                subtotal: new Prisma.Decimal(0),
                totalDiscount: new Prisma.Decimal(0),
                totalCgst: new Prisma.Decimal(0),
                totalSgst: new Prisma.Decimal(0),
                totalIgst: new Prisma.Decimal(0),
                netAmount: new Prisma.Decimal(0),
            }
        );

        const creditResult = await creditCheckService.checkCustomerCredit(
            data.customerId,
            Number(orderTotals.netAmount)
        );

        const reasons: string[] = [];
        let mdApprovalReason: string | null = null;
        let creditCheckOutstanding: Prisma.Decimal | null = null;
        let creditCheckLimit: Prisma.Decimal | null = null;
        let creditCheckExceededBy: Prisma.Decimal | null = null;

        if (!creditResult.withinLimit) {
            reasons.push("CREDIT_LIMIT_EXCEEDED");
            creditCheckExceededBy = new Prisma.Decimal(creditResult.exceededBy);
        }
        if (creditResult.hasOverdue) {
            reasons.push("OVERDUE_INVOICE");
        }

        if (reasons.length > 0) {
            mdApprovalReason = reasons.join(",");
            creditCheckOutstanding = new Prisma.Decimal(creditResult.outstanding);
            creditCheckLimit = new Prisma.Decimal(creditResult.creditLimit);
        }

        return prisma.salesOrder.create({
            data: {
                orderNo: data.orderNo,
                orderDate: new Date(data.orderDate),
                expectedCompletionDate: new Date(data.expectedCompletionDate),
                isInterState,
                customerId: data.customerId,
                customerType: data.customerType,
                salesPersonName: data.salesPersonName || null,
                transportName: data.transportName || null,
                paymentTermId: data.paymentTermId,
                billingAddressLine1: data.billingAddressLine1,
                billingCity: data.billingCity,
                billingState: data.billingState,
                billingPincode: data.billingPincode,
                billingCountry: data.billingCountry || "India",
                shippingAddressLine1: data.sameAsBilling ? data.billingAddressLine1 : data.shippingAddressLine1,
                shippingCity: data.sameAsBilling ? data.billingCity : data.shippingCity,
                shippingState: data.sameAsBilling ? data.billingState : data.shippingState,
                shippingPincode: data.sameAsBilling ? data.billingPincode : data.shippingPincode,
                shippingCountry: data.sameAsBilling ? (data.billingCountry || "India") : (data.shippingCountry || "India"),
                sameAsBilling: data.sameAsBilling,
                remarks: data.remarks,
                dispatchType: data.dispatchType,
                orderType: data.orderType,
                internalNotes: data.internalNotes,
                createdBy: data.createdBy,
                status: data.status,
                orderDiscountType,
                orderDiscountValue,
                subtotal: orderTotals.subtotal,
                totalDiscount: orderTotals.totalDiscount,
                totalCgst: orderTotals.totalCgst,
                totalSgst: orderTotals.totalSgst,
                totalIgst: orderTotals.totalIgst,
                netAmount: orderTotals.netAmount,
                mdApprovalReason,
                creditCheckOutstanding,
                creditCheckLimit,
                creditCheckExceededBy,
                items: {
                    create: lineCalcs.map((line) => ({
                        productId: line.productId,
                        quantity: line.quantity,
                        mrp: line.mrp,
                        b2b: line.b2b,
                        b2c: line.b2c,
                        exportPrice: line.exportPrice,
                        discountType: line.discountType,
                        discountValue: line.discountValue,
                        discountAmount: line.discountAmount,
                        lineSubtotal: line.lineSubtotal,
                        taxableAmount: line.taxableValue,
                        cgstRate: line.cgstRate,
                        cgstAmount: line.cgstAmount,
                        sgstRate: line.sgstRate,
                        sgstAmount: line.sgstAmount,
                        igstRate: line.igstRate,
                        igstAmount: line.igstAmount,
                        lineTotal: line.lineTotal,
                        gstTaxRateId: line.gstTaxRateId,
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productCode: true,
                                productName: true,
                            }
                        }
                    }
                },
                customer: {
                    select: {
                        id: true,
                        firmName: true,
                        displayName: true,
                    }
                },
            },
        });
    }

    // ─── List and Find ──────────────────────────────────────────────────

    async findAll(query: SalesOrderQueryInput) {
        const page = Math.max(1, query.page);
        const pageSize = Math.min(100, Math.max(1, query.pageSize));

        const where: Prisma.SalesOrderWhereInput = {
            ...(query.customerId && { customerId: query.customerId }),
            ...(query.status && query.status.length > 0 && {
                status: { in: query.status as SalesOrderStatus[] }
            }),
            ...(query.dispatchType && {
                dispatchType: { equals: query.dispatchType, mode: "insensitive" }
            }),
            ...(query.orderType && { orderType: query.orderType }),
            ...(query.mdApprovalStatus && { mdApprovalStatus: query.mdApprovalStatus as any }),
            ...(query.customerApprovalStatus && { customerApprovalStatus: query.customerApprovalStatus as any }),
            ...(query.search && {
                OR: [
                    { orderNo: { contains: query.search, mode: "insensitive" } },
                    { customer: { displayName: { contains: query.search, mode: "insensitive" } } }
                ]
            }),
            ...((query.fromDate || query.toDate) && {
                orderDate: {
                    ...(query.fromDate && { gte: new Date(query.fromDate) }),
                    ...(query.toDate && { lte: new Date(query.toDate) }),
                }
            }),
        };

        const [data, total] = await Promise.all([
            prisma.salesOrder.findMany({
                where,
                include: {
                    customer: {
                        select: { id: true, firmName: true, displayName: true }
                    },
                    items: {
                        include: {
                            product: {
                                select: { id: true, productCode: true, productName: true }
                            }
                        },
                    },
                },
                orderBy: { [query.sortBy]: query.sortOrder },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.salesOrder.count({ where }),
        ]);

        return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    async findById(id: number) {
        const order = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                },
                mdApprovedByUser: {
                    select: { userId: true, fullName: true }
                },
                createdByUser: {
                    select: { userId: true, fullName: true }
                },
            },
        });

        if (!order) {
            throw new ApiError(404, `Sales order with ID ${id} not found`);
        }
        return order;
    }

    // ─── Update Sales Order ─────────────────────────────────────────────

    async update(id: number, data: UpdateSalesOrderInput) {
        const existing = await this.findById(id);

        if (existing.mdApprovalStatus === "APPROVED") {
            throw new ApiError(409, "Cannot edit a sales order after MD approval");
        }

        const editableStatuses = ["DRAFT", "CONFIRMED", "MD_REJECTED"];
        if (!editableStatuses.includes(existing.status)) {
            throw new ApiError(409, `Cannot edit order in status ${existing.status}.`);
        }

        const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};

        if (existing.status === "MD_REJECTED") {
            updateData.mdApprovalStatus = "PENDING";
            updateData.mdApprovedBy = null;
            updateData.mdApprovedAt = null;
            updateData.mdRejectionReason = null;
            updateData.customerApprovalStatus = "PENDING";
            updateData.customerApprovedAt = null;
            updateData.customerRejectionReason = null;
        }

        if (data.customerType !== undefined) updateData.customerType = data.customerType;
        if (data.salesPersonName !== undefined) updateData.salesPersonName = data.salesPersonName;
        if (data.transportName !== undefined) updateData.transportName = data.transportName;
        if (data.expectedCompletionDate) updateData.expectedCompletionDate = new Date(data.expectedCompletionDate);
        if (data.paymentTermId !== undefined) updateData.paymentTermId = data.paymentTermId;
        if (data.dispatchType !== undefined) updateData.dispatchType = data.dispatchType;
        if (data.orderType !== undefined) updateData.orderType = data.orderType;
        if (data.sameAsBilling !== undefined) updateData.sameAsBilling = data.sameAsBilling;
        if (data.remarks !== undefined) updateData.remarks = data.remarks;
        if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.isInterState !== undefined) updateData.isInterState = data.isInterState;

        if (data.orderDiscountType !== undefined) {
            updateData.orderDiscountType = data.orderDiscountType;
        }
        if (data.orderDiscountValue !== undefined) {
            updateData.orderDiscountValue = new Prisma.Decimal(data.orderDiscountValue);
        }

        const orderDiscountType = data.orderDiscountType !== undefined ? data.orderDiscountType : (existing.orderDiscountType ?? "PERCENT");
        const orderDiscountValue = data.orderDiscountValue !== undefined ? new Prisma.Decimal(data.orderDiscountValue) : new Prisma.Decimal(existing.orderDiscountValue ?? 0);

        const isInterState = data.isInterState ?? existing.isInterState;

        if (data.billingAddressLine1 !== undefined) {
            updateData.billingAddressLine1 = data.billingAddressLine1;
        }
        if (data.billingCity !== undefined) {
            updateData.billingCity = data.billingCity;
        }
        if (data.billingState !== undefined) {
            updateData.billingState = data.billingState;
        }
        if (data.billingPincode !== undefined) {
            updateData.billingPincode = data.billingPincode;
        }
        if (data.billingCountry !== undefined) {
            updateData.billingCountry = data.billingCountry;
        }

        if (data.dispatchType !== undefined) {
            updateData.dispatchType = data.dispatchType;
        }

        if (data.orderType !== undefined) {
            updateData.orderType = data.orderType;
        }

        if (data.shippingAddressLine1 !== undefined) {
            updateData.shippingAddressLine1 = data.shippingAddressLine1;
        }
        if (data.shippingCity !== undefined) {
            updateData.shippingCity = data.shippingCity;
        }
        if (data.shippingState !== undefined) {
            updateData.shippingState = data.shippingState;
        }
        if (data.shippingPincode !== undefined) {
            updateData.shippingPincode = data.shippingPincode;
        }
        if (data.shippingCountry !== undefined) {
            updateData.shippingCountry = data.shippingCountry;
        }

        if (data.sameAsBilling !== undefined) {
            updateData.sameAsBilling = data.sameAsBilling;
        }

        if (data.remarks !== undefined) {
            updateData.remarks = data.remarks;
        }

        if (data.internalNotes !== undefined) {
            updateData.internalNotes = data.internalNotes;
        }

        if (data.status !== undefined) {
            updateData.status = data.status;
        }

        // Handle items update if provided
        if (data.items) {
            this.assertNoDuplicateProducts(data.items);

            const productIds = data.items.map((i) => BigInt(i.productId));
            await this.assertProductsExist(productIds);

            const pricingMap = await this.getProductPricingMap(
                data.items.map((i) => ({ productId: BigInt(i.productId), gstTaxRateId: i.gstTaxRateId }))
            );

            const customGstTaxRateIds = new Set<string>();
            data.items.forEach((i) => {
                if (i.gstTaxRateId) customGstTaxRateIds.add(i.gstTaxRateId);
            });
            const customGstTaxRates = await prisma.gstTaxRate.findMany({
                where: { id: { in: Array.from(customGstTaxRateIds) } },
                select: { id: true, taxRate: true }
            });
            const customGstTaxRateMap = new Map(customGstTaxRates.map((r) => [r.id, r.taxRate]));

            const lineCalcs = this.calculateLinesWithOrderDiscount(
                data.items.map((item) => {
                    const productId = BigInt(item.productId);
                    const pricing = this.resolvePricing(pricingMap, productId);
                    if (!pricing) {
                        throw new ApiError(404, `Product with ID ${item.productId} not found`);
                    }

                    let customGstRate: Prisma.Decimal | null = null;
                    if (item.gstTaxRateId) {
                        const rate = customGstTaxRateMap.get(item.gstTaxRateId);
                        if (rate === undefined) {
                            throw new ApiError(400, `GST Tax Rate with ID ${item.gstTaxRateId} not found`);
                        }
                        customGstRate = rate;
                    }

                    return {
                        productId,
                        quantity: new Prisma.Decimal(item.quantity),
                        pricing,
                        gstTaxRateId: item.gstTaxRateId,
                        customGstRate,
                    };
                }),
                data.customerType ?? existing.customerType,
                isInterState,
                orderDiscountType,
                orderDiscountValue
            );

            // Replace items
            await prisma.salesOrderItem.deleteMany({
                where: { salesOrderId: id }
            });

            updateData.items = {
                create: lineCalcs.map((line) => ({
                    productId: line.productId,
                    quantity: line.quantity,
                    mrp: line.mrp,
                    b2b: line.b2b,
                    b2c: line.b2c,
                    exportPrice: line.exportPrice,
                    discountType: line.discountType,
                    discountValue: line.discountValue,
                    discountAmount: line.discountAmount,
                    lineSubtotal: line.lineSubtotal,
                    taxableAmount: line.taxableValue,
                    cgstRate: line.cgstRate,
                    cgstAmount: line.cgstAmount,
                    sgstRate: line.sgstRate,
                    sgstAmount: line.sgstAmount,
                    igstRate: line.igstRate,
                    igstAmount: line.igstAmount,
                    lineTotal: line.lineTotal,
                    gstTaxRateId: line.gstTaxRateId,
                })),
            };

            const orderTotals = lineCalcs.reduce(
                (acc, line) => ({
                    subtotal: acc.subtotal.add(line.lineSubtotal),
                    totalDiscount: acc.totalDiscount.add(line.discountAmount),
                    totalCgst: acc.totalCgst.add(line.cgstAmount),
                    totalSgst: acc.totalSgst.add(line.sgstAmount),
                    totalIgst: acc.totalIgst.add(line.igstAmount),
                    netAmount: acc.netAmount.add(line.lineTotal),
                }),
                {
                    subtotal: new Prisma.Decimal(0),
                    totalDiscount: new Prisma.Decimal(0),
                    totalCgst: new Prisma.Decimal(0),
                    totalSgst: new Prisma.Decimal(0),
                    totalIgst: new Prisma.Decimal(0),
                    netAmount: new Prisma.Decimal(0),
                }
            );

            updateData.subtotal = orderTotals.subtotal;
            updateData.totalDiscount = orderTotals.totalDiscount;
            updateData.totalCgst = orderTotals.totalCgst;
            updateData.totalSgst = orderTotals.totalSgst;
            updateData.totalIgst = orderTotals.totalIgst;
            updateData.netAmount = orderTotals.netAmount;
        } else if (data.orderDiscountType !== undefined || data.orderDiscountValue !== undefined) {
            const lineCalcs = this.calculateLinesWithOrderDiscount(
                existing.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    pricing: {
                        id: item.productId,
                        b2b: item.b2b,
                        mrp: item.mrp,
                        b2c: item.b2c,
                        exportPrice: item.exportPrice,
                        gstTaxRateId: item.gstTaxRateId,
                        gstRate: item.igstRate.gt(0) ? item.igstRate : item.cgstRate.add(item.sgstRate),
                    },
                    gstTaxRateId: item.gstTaxRateId,
                    customGstRate: item.igstRate.gt(0) ? item.igstRate : item.cgstRate.add(item.sgstRate),
                })),
                data.customerType ?? existing.customerType,
                isInterState,
                orderDiscountType,
                orderDiscountValue
            );

            await prisma.$transaction(async (tx) => {
                for (let i = 0; i < existing.items.length; i++) {
                    const line = lineCalcs[i];
                    const item = existing.items[i];
                    await tx.salesOrderItem.update({
                        where: { id: item.id },
                        data: {
                            discountType: line.discountType,
                            discountValue: line.discountValue,
                            discountAmount: line.discountAmount,
                            taxableAmount: line.taxableValue,
                            cgstAmount: line.cgstAmount,
                            sgstAmount: line.sgstAmount,
                            igstAmount: line.igstAmount,
                            lineTotal: line.lineTotal,
                        }
                    });
                }
            });

            const orderTotals = lineCalcs.reduce(
                (acc, line) => ({
                    subtotal: acc.subtotal.add(line.lineSubtotal),
                    totalDiscount: acc.totalDiscount.add(line.discountAmount),
                    totalCgst: acc.totalCgst.add(line.cgstAmount),
                    totalSgst: acc.totalSgst.add(line.sgstAmount),
                    totalIgst: acc.totalIgst.add(line.igstAmount),
                    netAmount: acc.netAmount.add(line.lineTotal),
                }),
                {
                    subtotal: new Prisma.Decimal(0),
                    totalDiscount: new Prisma.Decimal(0),
                    totalCgst: new Prisma.Decimal(0),
                    totalSgst: new Prisma.Decimal(0),
                    totalIgst: new Prisma.Decimal(0),
                    netAmount: new Prisma.Decimal(0),
                }
            );

            updateData.subtotal = orderTotals.subtotal;
            updateData.totalDiscount = orderTotals.totalDiscount;
            updateData.totalCgst = orderTotals.totalCgst;
            updateData.totalSgst = orderTotals.totalSgst;
            updateData.totalIgst = orderTotals.totalIgst;
            updateData.netAmount = orderTotals.netAmount;
        }

        return prisma.salesOrder.update({
            where: { id },
            data: updateData,
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, productCode: true, productName: true }
                        }
                    }
                },
                customer: {
                    select: { id: true, firmName: true, displayName: true }
                },
            },
        });
    }

    // ─── Update Item Discounts ──────────────────────────────────────────

    async updateDiscounts(id: number, data: UpdateSalesOrderDiscountsInput) {
        const existing = await this.findById(id);

        if (existing.status !== "DRAFT" && existing.status !== "CONFIRMED" && existing.status !== "MD_REJECTED") {
            throw new ApiError(409, `Cannot edit discounts once order status is ${existing.status}.`);
        }

        const itemIds = data.items.map((i) => BigInt(i.itemId));

        // Fetch items with stored price tiers and GST rates
        const existingItems = await prisma.salesOrderItem.findMany({
            where: { id: { in: itemIds }, salesOrderId: id },
            select: {
                id: true,
                quantity: true,
                b2b: true,
                mrp: true,
                b2c: true,
                exportPrice: true,
                lineSubtotal: true,
                discountAmount: true,
                taxableAmount: true,
                cgstRate: true,
                sgstRate: true,
                igstRate: true,
                cgstAmount: true,
                sgstAmount: true,
                igstAmount: true,
            }
        });

        if (existingItems.length !== itemIds.length) {
            const foundIds = new Set(existingItems.map((i) => i.id.toString()));
            const missing = itemIds
                .filter((id) => !foundIds.has(id.toString()))
                .map((id) => id.toString());
            throw new ApiError(404, `Item(s) not found on this sales order: ${missing.join(", ")}`);
        }

        const itemMap = new Map(existingItems.map((i) => [i.id.toString(), i]));

        return prisma.$transaction(async (tx) => {
            let runningSubtotal = new Prisma.Decimal(0);
            let runningDiscount = new Prisma.Decimal(0);
            let runningCgst = new Prisma.Decimal(0);
            let runningSgst = new Prisma.Decimal(0);
            let runningIgst = new Prisma.Decimal(0);

            const isInterState = existing.isInterState;

            for (const incoming of data.items) {
                const current = itemMap.get(incoming.itemId.toString())!;

                const unitPrice = this.resolveUnitPrice(existing.customerType, {
                    b2b: current.b2b,
                    mrp: current.mrp,
                    b2c: current.b2c,
                    exportPrice: current.exportPrice,
                });

                const newLineSubtotal = current.quantity.mul(unitPrice);

                const discountAmount = incoming.discountType === "PERCENT"
                    ? newLineSubtotal.mul(incoming.discountValue).div(100)
                    : new Prisma.Decimal(incoming.discountValue);

                const cappedDiscount = discountAmount.gt(newLineSubtotal) ? newLineSubtotal : discountAmount;
                const newTaxableValue = newLineSubtotal.sub(cappedDiscount);

                // Determine total GST rate from stored split rates
                let totalGstRate: Prisma.Decimal;
                if (isInterState) {
                    totalGstRate = current.igstRate;
                } else {
                    totalGstRate = current.cgstRate.add(current.sgstRate);
                }

                const totalGstAmount = newTaxableValue.mul(totalGstRate).div(100);

                let newCgstAmount: Prisma.Decimal, newSgstAmount: Prisma.Decimal, newIgstAmount: Prisma.Decimal;
                if (isInterState) {
                    newIgstAmount = totalGstAmount;
                    newCgstAmount = new Prisma.Decimal(0);
                    newSgstAmount = new Prisma.Decimal(0);
                } else {
                    newCgstAmount = totalGstAmount.div(2);
                    newSgstAmount = totalGstAmount.div(2);
                    newIgstAmount = new Prisma.Decimal(0);
                }

                const newLineTotal = newTaxableValue.add(totalGstAmount);

                await tx.salesOrderItem.update({
                    where: { id: current.id },
                    data: {
                        discountType: incoming.discountType,
                        discountValue: new Prisma.Decimal(incoming.discountValue),
                        discountAmount: cappedDiscount,
                        lineSubtotal: newLineSubtotal,
                        taxableAmount: newTaxableValue,
                        cgstAmount: newCgstAmount,
                        sgstAmount: newSgstAmount,
                        igstAmount: newIgstAmount,
                        lineTotal: newLineTotal,
                    },
                });

                runningSubtotal = runningSubtotal.add(newLineSubtotal);
                runningDiscount = runningDiscount.add(cappedDiscount);
                runningCgst = runningCgst.add(newCgstAmount);
                runningSgst = runningSgst.add(newSgstAmount);
                runningIgst = runningIgst.add(newIgstAmount);
            }

            // Add untouched items (not in the update list)
            const untouchedItems = existing.items.filter(
                (i) => !itemMap.has(i.id.toString())
            );
            for (const item of untouchedItems) {
                runningSubtotal = runningSubtotal.add(item.lineSubtotal);
                runningDiscount = runningDiscount.add(item.discountAmount);
                runningCgst = runningCgst.add(item.cgstAmount);
                runningSgst = runningSgst.add(item.sgstAmount);
                runningIgst = runningIgst.add(item.igstAmount);
            }

            const netAmount = runningSubtotal
                .sub(runningDiscount)
                .add(runningCgst)
                .add(runningSgst)
                .add(runningIgst);

            return tx.salesOrder.update({
                where: { id },
                data: {
                    subtotal: runningSubtotal,
                    totalDiscount: runningDiscount,
                    totalCgst: runningCgst,
                    totalSgst: runningSgst,
                    totalIgst: runningIgst,
                    netAmount,
                },
                include: {
                    items: {
                        include: {
                            product: {
                                select: { id: true, productCode: true, productName: true }
                            }
                        }
                    },
                    customer: {
                        select: { id: true, firmName: true, displayName: true }
                    },
                },
            });
        });
    }

    // ─── Workflow Actions ──────────────────────────────────────────────

    async submitForMdApproval(id: number) {
        const existing = await this.findById(id);
        if (existing.status !== "DRAFT" && existing.status !== "CONFIRMED" && existing.status !== "MD_REJECTED") {
            throw new ApiError(409, `Only orders in DRAFT status can be submitted for MD approval. Current status: ${existing.status}`);
        }
        if (existing.items.length === 0) {
            throw new ApiError(400, "Cannot submit an order with no items");
        }
        return prisma.salesOrder.update({
            where: { id },
            data: { status: "PENDING_MD_APPROVAL" },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, productCode: true, productName: true }
                        }
                    }
                },
                customer: {
                    select: { id: true, firmName: true, displayName: true }
                },
            },
        });
    }

    async reopen(id: number) {
        const existing = await this.findById(id);
        if (existing.status !== "MD_REJECTED" && existing.status !== "CUSTOMER_REJECTED") {
            throw new ApiError(409, `Only orders with status MD_REJECTED or CUSTOMER_REJECTED can be reopened. Current status: ${existing.status}`);
        }
        return prisma.salesOrder.update({
            where: { id },
            data: {
                status: "DRAFT",
                mdApprovalStatus: "PENDING",
                mdApprovedBy: null,
                mdApprovedAt: null,
                mdRejectionReason: null,
                customerApprovalStatus: "PENDING",
                customerApprovedAt: null,
                customerRejectionReason: null,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, productCode: true, productName: true }
                        }
                    }
                },
                customer: {
                    select: { id: true, firmName: true, displayName: true }
                },
            },
        });
    }

    async delete(id: number) {
        const existing = await this.findById(id);
        if (existing.status !== "DRAFT") {
            throw new ApiError(409, `Only orders with status draft can be deleted`);
        }
        return prisma.salesOrder.delete({ where: { id } });
    }

    async decideMdApproval(id: number, data: MdApprovalDecisionInput) {
        const existing = await this.findById(id);
        if (existing.status !== "PENDING_MD_APPROVAL") {
            throw new ApiError(409, `Order must be in PENDING_MD_APPROVAL status. Current status: ${existing.status}`);
        }
        if (existing.mdApprovalStatus !== "PENDING") {
            throw new ApiError(409, `MD approval already decided (${existing.mdApprovalStatus})`);
        }
        if (data.decision === "REJECTED" && !data.rejectionReason) {
            throw new ApiError(400, "Rejection reason is required when rejecting");
        }

        let approverId = data.approverId;
        if (approverId && approverId.startsWith("admin_")) {
            const firstUser = await prisma.user.findFirst();
            if (firstUser) {
                approverId = firstUser.userId;
            } else {
                approverId = null as any;
            }
        }

        return prisma.salesOrder.update({
            where: { id },
            data: {
                mdApprovalStatus: data.decision,
                mdApprovedBy: approverId,
                mdApprovedAt: new Date(),
                mdRejectionReason: data.decision === "REJECTED" ? data.rejectionReason : null,
                status: data.decision === "APPROVED" ? "IN_PRODUCTION" : "MD_REJECTED",
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, productCode: true, productName: true }
                        }
                    }
                },
                customer: {
                    select: { id: true, firmName: true, displayName: true }
                },
            },
        });
    }

    async decideCustomerApproval(id: number, data: CustomerApprovalDecisionInput) {
        const existing = await this.findById(id);
        if (existing.status !== "PENDING_CUSTOMER_APPROVAL") {
            throw new ApiError(409, `Order must be in PENDING_CUSTOMER_APPROVAL status. Current status: ${existing.status}`);
        }
        if (existing.mdApprovalStatus !== "APPROVED") {
            throw new ApiError(409, "Customer approval is not available until MD has approved this order");
        }
        if (existing.customerApprovalStatus !== "PENDING") {
            throw new ApiError(409, `Customer approval already decided (${existing.customerApprovalStatus})`);
        }
        if (data.decision === "REJECTED" && !data.rejectionReason) {
            throw new ApiError(400, "Rejection reason is required when rejecting");
        }
        return prisma.salesOrder.update({
            where: { id },
            data: {
                customerApprovalStatus: data.decision,
                customerApprovedAt: data.decision === "APPROVED" ? new Date() : null,
                customerRejectionReason: data.decision === "REJECTED" ? data.rejectionReason : null,
                status: data.decision === "APPROVED" ? "CONFIRMED" : "CUSTOMER_REJECTED",
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, productCode: true, productName: true }
                        }
                    }
                },
                customer: {
                    select: { id: true, firmName: true, displayName: true }
                },
            },
        });
    }

    async getNextSalesOrderCode() {
        const currentYear = new Date().getFullYear();
        const lastSalesOrder = await prisma.salesOrder.findFirst({
            where: { orderNo: { startsWith: `SO-${currentYear}-` } },
            orderBy: { id: "desc" },
        });
        if (!lastSalesOrder) {
            return `SO-${currentYear}-001`;
        }
        const lastCode = lastSalesOrder.orderNo;
        const match = lastCode.match(/SO-\d{4}-(\d+)/);
        if (!match) {
            return `SO-${currentYear}-001`;
        }
        const nextNumber = parseInt(match[1], 10) + 1;
        const paddedNumber = String(nextNumber).padStart(3, "0");
        return `SO-${currentYear}-${paddedNumber}`;
    }

    async getOrderStatus(id: number) {
        const order = await this.findById(id);
        return {
            id: order.id,
            orderNo: order.orderNo,
            status: order.status,
            mdApprovalStatus: order.mdApprovalStatus,
            customerApprovalStatus: order.customerApprovalStatus,
            canEdit: order.status === "DRAFT",
            canDelete: order.mdApprovalStatus !== "APPROVED",
            canEditDiscounts: order.status === "DRAFT",
            canSubmitForMdApproval: order.status === "DRAFT" && order.items.length > 0,
            canApproveMd: order.status === "PENDING_MD_APPROVAL" && order.mdApprovalStatus === "PENDING",
            canApproveCustomer: order.status === "PENDING_CUSTOMER_APPROVAL"
                && order.mdApprovalStatus === "APPROVED"
                && order.customerApprovalStatus === "PENDING",
            canReopen: order.status === "MD_REJECTED" || order.status === "CUSTOMER_REJECTED",
            totalItems: order.items.length,
            subtotal: order.subtotal,
            totalDiscount: order.totalDiscount,
            totalCgst: order.totalCgst,
            totalSgst: order.totalSgst,
            totalIgst: order.totalIgst,
            netAmount: order.netAmount,
            orderDate: order.orderDate,
            expectedCompletionDate: order.expectedCompletionDate,
            customerName: order.customer.displayName || order.customer.firmName,
        };
    }
}

export default new SalesOrderService();