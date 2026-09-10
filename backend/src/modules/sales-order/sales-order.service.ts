import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import {
    CreateSalesOrderInput,
    UpdateSalesOrderInput,
    SalesOrderQueryInput,
    SalesOrderStatus,
} from "./sales-order.validation";

// ─── Shared zero constant ──────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);

// ─── Bill Sundry helper ──────────────────────────────────────────────────────

const SUNDRY_SIGN: Record<string, number> = {
    BILL_TAX_MINUS: -1, BILL_TAX_PLUS: 1,
    DISCOUNT_MINUS: -1, DISCOUNT_PLUS: 1,
    LORRY_FREIGHT_MINUS: -1, LORRY_FREIGHT_PLUS: 1,
    OTHERS_MINUS: -1, OTHERS_PLUS: 1,
    ROUND_OFF_MINUS: -1, ROUND_OFF_PLUS: 1,
};

function calcBillSundryTotal(billSundry: any): Prisma.Decimal {
    if (!Array.isArray(billSundry) || billSundry.length === 0) return ZERO;
    return billSundry.reduce((sum: Prisma.Decimal, row: any) => {
        const amount = new Prisma.Decimal(Number(row.amount) || 0);
        const sign = SUNDRY_SIGN[row.type] ?? 1;
        return sign === -1 ? sum.sub(amount) : sum.add(amount);
    }, ZERO);
}

// ─── Prisma include shape ──────────────────────────────────────────────────────

/** Include for GST orders (sales_orders → sales_order_items) */
const INCLUDE_GST = {
    items: {
        include: {
            product: { select: { id: true, productCode: true, productName: true } },
        },
    },
    customer: { select: { id: true, customerCode: true, firmName: true, displayName: true, addresses: true, openingBalance: true, openingBalanceType: true } },
    sourceEmployee: { select: { id: true, empCode: true, fullName: true } },
    referredByCustomer: { select: { id: true, firmName: true, displayName: true } },
    createdByUser: { select: { userId: true, fullName: true } },
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

type IncomingItem = { productId: string | number | bigint; quantity: number | string; salesProductId?: number | null };

interface GstItemInput {
    cgstRate?:     number | null;
    sgstRate?:     number | null;
    igstRate?:     number | null;
}

// ─── Service ───────────────────────────────────────────────────────────────────

class SalesOrderService {

    // ─── Shared helpers ──────────────────────────────────────────────────────

    private async assertProductsExist(productIds: bigint[]) {
        if (productIds.length === 0) throw new ApiError(400, "No product IDs provided");
        const unique = [...new Set(productIds.map(id => id.toString()))];
        const found = await prisma.product.findMany({
            where: { id: { in: unique.map(id => BigInt(id)) }, isActive: true },
            select: { id: true },
        });
        if (found.length !== unique.length) {
            const foundIds = new Set(found.map(f => f.id.toString()));
            const missing = unique.filter(id => !foundIds.has(id));
            throw new ApiError(404, `Product(s) not found or inactive: ${missing.join(", ")}`);
        }
    }

    private assertNoDuplicateProducts(items: IncomingItem[]) {
        const seen = new Map<string, number>();
        const dupes = new Set<string>();
        items.forEach(item => {
            const key = item.salesProductId
                ? `${item.productId}:${item.salesProductId}`
                : String(item.productId);
            if (seen.has(key)) dupes.add(key);
            else seen.set(key, 0);
        });
        if (dupes.size > 0) {
            throw new ApiError(400, `Duplicate item(s): ${[...dupes].map(k => `productId=${k}`).join(" | ")}`);
        }
    }

      private async computeLineTotals(
          items: { productId: bigint; quantity: Prisma.Decimal; unitPrice?: Prisma.Decimal | number | string | null; quotationUnitPrice?: Prisma.Decimal | number | string | null }[],
        customerGradeName?: string | null,
    ) {
        const uniqueIds = [...new Set(items.map(i => i.productId.toString()))];
        const products = await prisma.product.findMany({
            where: { id: { in: uniqueIds.map(id => BigInt(id)) } },
            select: { id: true, rate: true, gradeRates: true } as any,
        });

        const rateMap = new Map(products.map((p: any) => {
            let effectiveRate: Prisma.Decimal = p.rate ?? ZERO;
            if (customerGradeName && p.gradeRates && typeof p.gradeRates === "object") {
                const gradeRates = p.gradeRates as Record<string, number>;
                const gClean = customerGradeName.toUpperCase().replace(/[^A-Z0-9]/g, "");
                for (const [k, val] of Object.entries(gradeRates)) {
                    const kClean = k.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    if (kClean === gClean || kClean.endsWith(gClean) || gClean.endsWith(kClean)) {
                        if (val != null && !isNaN(Number(val)) && Number(val) > 0) {
                            effectiveRate = new Prisma.Decimal(val);
                            break;
                        }
                    }
                }
            }
            return [p.id.toString(), effectiveRate];
        }));

        return items.map(item => {
            let rate: Prisma.Decimal;
            const requestedPrice = item.quotationUnitPrice ?? item.unitPrice;
            if (requestedPrice !== undefined && requestedPrice !== null && requestedPrice !== "" && !isNaN(Number(requestedPrice))) {
                rate = new Prisma.Decimal(requestedPrice);
            } else {
                rate = rateMap.get(item.productId.toString()) ?? ZERO;
            }
            return {
                productId: item.productId,
                quantity:  item.quantity,
                rate,
                lineTotal: item.quantity.mul(rate),
            };
        });
    }

    /**
     * Resolves GST rates from explicit cgst/sgst/igst rates sent by the client.
     * Intra-state: CGST+SGST. Inter-state: full IGST.
     */
    private resolveGstRates(raw: any, isInterState: boolean): GstItemInput {
        const hasExplicit = raw.cgstRate != null || raw.sgstRate != null || raw.igstRate != null;
        if (hasExplicit) {
            return { cgstRate: raw.cgstRate, sgstRate: raw.sgstRate, igstRate: raw.igstRate };
        }
        return { cgstRate: 0, sgstRate: 0, igstRate: 0 };
    }

    private computeGstAmounts(lineTotal: Prisma.Decimal, gst: GstItemInput, isInterState: boolean) {
        const taxable = lineTotal;
        let cgstRate = ZERO, sgstRate = ZERO, igstRate = ZERO;

        if (isInterState) {
            igstRate = new Prisma.Decimal(gst.igstRate ?? 0);
        } else {
            cgstRate = new Prisma.Decimal(gst.cgstRate ?? 0);
            sgstRate = new Prisma.Decimal(gst.sgstRate ?? 0);
        }

        const cgstAmount = taxable.mul(cgstRate).div(100);
        const sgstAmount = taxable.mul(sgstRate).div(100);
        const igstAmount = taxable.mul(igstRate).div(100);

        return { taxableAmount: taxable, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount };
    }

    // ─── Create ──────────────────────────────────────────────────────────────

    async create(data: CreateSalesOrderInput, _permissions: string[] = []) {
        if (!data.items || data.items.length === 0) throw new ApiError(400, "At least one item is required");
        this.assertNoDuplicateProducts(data.items);

        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
            include: { customerGrade: { select: { name: true } } },
        });
        if (!customer) throw new ApiError(404, `Customer ${data.customerId} not found`);

        await this.assertProductsExist(data.items.map(i => BigInt(i.productId)));

        const existingCheck = await prisma.salesOrder.findUnique({ where: { orderNo: data.orderNo } });
        if (existingCheck) throw new ApiError(409, `Order No "${data.orderNo}" already exists`);

        const isQuotation = data.status === "QUOTED" || Boolean((data as any).isQuotation) || data.items.some((i: any) => i.quotationUnitPrice !== undefined && i.quotationUnitPrice !== null);
        const lineItems = await this.computeLineTotals(
            data.items.map(i => ({
                productId: BigInt(i.productId),
                quantity: new Prisma.Decimal(i.quantity),
                unitPrice: isQuotation ? undefined : (i as any).unitPrice,
                quotationUnitPrice: isQuotation ? (i as any).quotationUnitPrice : undefined,
            })),
            (customer as any).customerGrade?.name ?? null,
        );

        const isInterState = data.isInterState ?? false;
        const itemsWithGst = lineItems.map((l, idx) => {
            const raw = data.items[idx] as any;
            const gstInput = this.resolveGstRates(raw, isInterState);
            const gst = this.computeGstAmounts(l.lineTotal, gstInput, isInterState);
            return { ...l, ...gst };
        });

        const createSubtotal  = itemsWithGst.reduce((s, l) => s.add(l.lineTotal),   ZERO);
        const createTotalCgst = itemsWithGst.reduce((s, l) => s.add(l.cgstAmount),  ZERO);
        const createTotalSgst = itemsWithGst.reduce((s, l) => s.add(l.sgstAmount),  ZERO);
        const createTotalIgst = itemsWithGst.reduce((s, l) => s.add(l.igstAmount),  ZERO);
        const createTotalTax  = createTotalCgst.add(createTotalSgst).add(createTotalIgst);

        const discountValue = new Prisma.Decimal((data as any).orderDiscountValue || 0);
        const createDiscount = discountValue.lte(0)
            ? ZERO
            : ((data as any).orderDiscountType === "FLAT"
                ? discountValue
                : createSubtotal.mul(discountValue).div(100));

        // GST must be applied on taxable amount (subtotal after discount), not on gross subtotal
        const createTaxable      = createSubtotal.sub(createDiscount);
        const createDiscRatio    = createSubtotal.gt(ZERO) ? createTaxable.div(createSubtotal) : new Prisma.Decimal(1);
        const createAdjustedTax  = createTotalTax.mul(createDiscRatio);
        const createBillSundry   = calcBillSundryTotal((data as any).billSundry);
        const createNetAmount    = createTaxable.add(createAdjustedTax).add(createBillSundry);

        const gstOrder = await prisma.salesOrder.create({
            data: {
                orderNo:      data.orderNo,
                orderDate:    new Date(data.orderDate),
                isInterState,
                customerId:   data.customerId,
                mobile:       data.mobile || null,
                // @ts-ignore
                salesPersonName: data.salesPersonName || null,
                orderType:    data.orderType,
                referenceText: data.referenceText || null,
                narration:    data.narration,
                createdBy:    data.createdBy,
                status:       data.status,
                // Order Source fields
                // @ts-ignore
                orderSource:          (data as any).orderSource ?? null,
                sourceEmployeeId:     (data as any).sourceEmployeeId ? BigInt((data as any).sourceEmployeeId) : null,
                referredByCustomerId: (data as any).referredByCustomerId || null,
                referredByName:       (data as any).referredByName || null,
                subtotal:  createSubtotal,
                netAmount: createNetAmount,
                totalDiscount: createDiscount,
                orderDiscountType:  (data as any).orderDiscountType ?? null,
                orderDiscountValue: (data as any).orderDiscountValue || null,
                billSundry: (data as any).billSundry ?? null,
                // @ts-ignore
                sourceSalesOrderId: (data as any).sourceSalesOrderId ? Number((data as any).sourceSalesOrderId) : null,
                totalTax:  createTotalTax,
                totalCgst: createTotalCgst,
                totalSgst: createTotalSgst,
                totalIgst: createTotalIgst,
                items: {
                    create: itemsWithGst.map((l, idx) => ({
                        productId:     l.productId,
                        salesProductId: data.items[idx]?.salesProductId ? BigInt(data.items[idx].salesProductId!) : null,
                        quantity:      l.quantity,
                        unitPrice:     isQuotation ? ZERO : l.rate,
                        quotationUnitPrice: isQuotation ? l.rate : null,
                        lineTotal:     l.lineTotal,
                        taxableAmount: l.taxableAmount,
                        cgstRate:      l.cgstRate,
                        cgstAmount:    l.cgstAmount,
                        sgstRate:      l.sgstRate,
                        sgstAmount:    l.sgstAmount,
                        igstRate:      l.igstRate,
                        igstAmount:    l.igstAmount,
                    })),
                },
            },
            include: INCLUDE_GST,
        });

        // If this order has quotation prices and a source SO, mark the source as QUOTED
        if ((data as any).sourceSalesOrderId && data.status === "CONFIRMED" && isQuotation) {
            await prisma.salesOrder.update({
                where: { id: Number((data as any).sourceSalesOrderId) },
                data: { status: "QUOTED" as any },
            });
        }

        return gstOrder;
    }

    // ─── List ────────────────────────────────────────────────────────────────

    async findAll(query: SalesOrderQueryInput, _permissions: string[] = []) {
        const page     = Math.max(1, query.page);
        const pageSize = Math.min(500, Math.max(1, query.pageSize));
        const skip     = (page - 1) * pageSize;

        const searchFilter = query.search
            ? { OR: [
                { orderNo:  { contains: query.search, mode: "insensitive" as const } },
                { customer: { displayName: { contains: query.search, mode: "insensitive" as const } } },
            ] }
            : {};

        const dateFilter = (query.fromDate || query.toDate)
            ? { orderDate: {
                ...(query.fromDate && { gte: new Date(query.fromDate) }),
                ...(query.toDate   && { lte: new Date(query.toDate) }),
            } }
            : {};

        const conditions: any[] = [];

        if ((query as any).quotationOnly) {
            conditions.push({ status: "QUOTED" });
        }

        const customerFilter: any = {};
        if (query.customerId) customerFilter.id = query.customerId;
        if (query.customerGradeId) customerFilter.customerGradeId = Number(query.customerGradeId);
        if ((query as any).customerTypeId) customerFilter.customerTypeId = Number((query as any).customerTypeId);

        if (Object.keys(customerFilter).length > 0) {
            conditions.push({ customer: customerFilter });
        }
        if (query.status?.length) {
            conditions.push({ status: { in: query.status as SalesOrderStatus[] } });
        }
        if (query.orderType) {
            conditions.push({ orderType: query.orderType });
        }
        if ((query as any).orderSource) {
            conditions.push({ orderSource: (query as any).orderSource });
        }
        if ((query as any).sourceEmployeeId) {
            conditions.push({ sourceEmployeeId: BigInt((query as any).sourceEmployeeId) });
        }
        if (searchFilter && Object.keys(searchFilter).length > 0) {
            conditions.push(searchFilter);
        }
        if (dateFilter && Object.keys(dateFilter).length > 0) {
            conditions.push(dateFilter);
        }

        const gstWhere = conditions.length > 0 ? { AND: conditions } : {};

        const gstOrderBy = { [query.sortBy]: query.sortOrder };

        try {
            const [rows, total] = await Promise.all([
                prisma.salesOrder.findMany({
                    where: gstWhere as any, include: INCLUDE_GST as any, orderBy: gstOrderBy, skip, take: pageSize,
                }),
                prisma.salesOrder.count({ where: gstWhere as any }),
            ]);
            return {
                data: rows,
                total, page, pageSize,
                totalPages: Math.ceil(total / pageSize),
            };
        } catch (err: any) {
            throw err;
        }
    }

    // ─── Find by ID ──────────────────────────────────────────────────────────

    async findById(id: number, _permissions: string[] = []) {
        const order = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: { include: { customerGrade: true, customerType: true, addresses: true } },
                sourceEmployee: { select: { id: true, empCode: true, fullName: true } },
                referredByCustomer: { select: { id: true, firmName: true, displayName: true } },
                items: {
                    include: {
                        product: true,
                    },
                },
                createdByUser: { select: { userId: true, fullName: true } },
                salesInvoices: {
                    select: {
                        id: true,
                        invoiceNo: true,
                        invoiceDate: true,
                        subTotal: true,
                        discountType: true,
                        discountValue: true,
                        totalDiscount: true,
                        taxTotal: true,
                        grandTotal: true,
                        narration: true,
                        status: true,
                        items: {
                            select: {
                                productId: true,
                                quantity: true,
                                unitPrice: true,
                                taxableAmount: true,
                                cgstRate: true,
                                cgstAmount: true,
                                sgstRate: true,
                                sgstAmount: true,
                                igstRate: true,
                                igstAmount: true,
                                lineTotal: true,
                                discountAmount: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });
        if (!order) throw new ApiError(404, `Sales order with ID ${id} not found`);
        return order;
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    async update(id: number, data: UpdateSalesOrderInput, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const existingStatus = (existing as any).status as string;

        if (!["DRAFT", "CONFIRMED", "QUOTED", "QUOTATION_IN_PROGRESS", "QUOTATION_COMPLETED", "CUSTOMER_REJECTED"].includes(existingStatus)) {
            throw new ApiError(409, `Cannot edit order in status ${existingStatus}.`);
        }

        const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};
        if (data.mobile        !== undefined) updateData.mobile         = data.mobile;
        // @ts-ignore
        if ((data as any).salesPersonName !== undefined) updateData.salesPersonName = (data as any).salesPersonName;
        if (data.orderType     !== undefined) updateData.orderType      = data.orderType;
        if (data.referenceText !== undefined) updateData.referenceText  = data.referenceText;
        // Order Source fields
        if ((data as any).orderSource          !== undefined) (updateData as any).orderSource          = (data as any).orderSource || null;
        if ((data as any).sourceEmployeeId     !== undefined) (updateData as any).sourceEmployeeId     = (data as any).sourceEmployeeId ? BigInt((data as any).sourceEmployeeId) : null;
        if ((data as any).referredByCustomerId !== undefined) (updateData as any).referredByCustomerId = (data as any).referredByCustomerId || null;
        if ((data as any).referredByName       !== undefined) (updateData as any).referredByName       = (data as any).referredByName || null;
        if (data.narration     !== undefined) updateData.narration      = data.narration;
        if (data.status        !== undefined) updateData.status         = data.status;
        if (data.isInterState  !== undefined) updateData.isInterState   = data.isInterState;

        if (data.items) {
            this.assertNoDuplicateProducts(data.items);
            await this.assertProductsExist(data.items.map(i => BigInt(i.productId)));

            const isQuotation = data.status === "QUOTED" || existingStatus === "QUOTED" || Boolean((data as any).isQuotation) || data.items.some((item: any) => item.quotationUnitPrice !== undefined && item.quotationUnitPrice !== null);

            // Preserve original unitPrice from existing items (only needed for quotations)
            const existingUnitPrices = isQuotation
                ? new Map((existing.items as any[]).map((item: any) => [item.productId.toString(), item.unitPrice ?? ZERO]))
                : new Map<string, any>();

            // Fetch customer grade for grade-based pricing
            const customer = await prisma.customer.findUnique({
                where: { id: existing.customerId },
                include: { customerGrade: { select: { name: true } } },
            });

            const lineItems = await this.computeLineTotals(
                data.items.map(i => ({
                    productId: BigInt(i.productId),
                    quantity: new Prisma.Decimal(i.quantity),
                    unitPrice: isQuotation ? undefined : (i as any).unitPrice,
                    quotationUnitPrice: isQuotation ? (i as any).quotationUnitPrice : undefined,
                })),
                (customer as any)?.customerGrade?.name ?? null,
            );

            const isInterState = data.isInterState ?? (existing as any).isInterState ?? false;
            const itemsWithGst = lineItems.map((l, idx) => {
                const raw = data.items![idx] as any;
                const gstInput = this.resolveGstRates(raw, isInterState);
                const gst = this.computeGstAmounts(l.lineTotal, gstInput, isInterState);
                return { ...l, ...gst };
            });

            await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

            const updSubtotal  = itemsWithGst.reduce((s, l) => s.add(l.lineTotal),  ZERO);
            const updTotalCgst = itemsWithGst.reduce((s, l) => s.add(l.cgstAmount), ZERO);
            const updTotalSgst = itemsWithGst.reduce((s, l) => s.add(l.sgstAmount), ZERO);
            const updTotalIgst = itemsWithGst.reduce((s, l) => s.add(l.igstAmount), ZERO);
            const updTotalTax  = updTotalCgst.add(updTotalSgst).add(updTotalIgst);

            const updDiscType  = (data as any).orderDiscountType  ?? (existing as any).orderDiscountType ?? "PERCENT";
            const updDiscValue = new Prisma.Decimal((data as any).orderDiscountValue || (existing as any).orderDiscountValue || 0);
            const updDiscount  = updDiscValue.lte(0)
                ? ZERO
                : (updDiscType === "FLAT" ? updDiscValue : updSubtotal.mul(updDiscValue).div(100));

            // GST must be applied on taxable amount (subtotal after discount), not on gross subtotal
            const updTaxable     = updSubtotal.sub(updDiscount);
            const updDiscRatio   = updSubtotal.gt(ZERO) ? updTaxable.div(updSubtotal) : new Prisma.Decimal(1);
            const updAdjustedTax = updTotalTax.mul(updDiscRatio);

            const updBillSundry = calcBillSundryTotal((data as any).billSundry ?? (existing as any).billSundry);
            updateData.subtotal  = updSubtotal;
            updateData.netAmount = updTaxable.add(updAdjustedTax).add(updBillSundry);
            updateData.totalDiscount = updDiscount;
            if ((data as any).orderDiscountType  !== undefined) updateData.orderDiscountType  = (data as any).orderDiscountType;
            if ((data as any).orderDiscountValue !== undefined) updateData.orderDiscountValue = (data as any).orderDiscountValue || null;
            if ((data as any).billSundry !== undefined) updateData.billSundry = (data as any).billSundry ?? null;
            updateData.totalCgst = updTotalCgst;
            updateData.totalSgst = updTotalSgst;
            updateData.totalIgst = updTotalIgst;
            updateData.totalTax  = updTotalTax;
            updateData.items = {
                create: itemsWithGst.map((l, idx) => ({
                    productId:     l.productId,
                    salesProductId: data.items![idx]?.salesProductId ? BigInt((data.items![idx] as any).salesProductId) : null,
                    quantity:      l.quantity,
                    unitPrice:     isQuotation
                        ? (existingUnitPrices.get(l.productId.toString()) ?? ZERO)
                        : l.rate,
                    quotationUnitPrice: isQuotation ? l.rate : null,
                    lineTotal:     l.lineTotal,
                    taxableAmount: l.taxableAmount,
                    cgstRate:      l.cgstRate,
                    cgstAmount:    l.cgstAmount,
                    sgstRate:      l.sgstRate,
                    sgstAmount:    l.sgstAmount,
                    igstRate:      l.igstRate,
                    igstAmount:    l.igstAmount,
                })),
            };
        }

        const updated = await prisma.salesOrder.update({ where: { id }, data: updateData, include: INCLUDE_GST });

        // If a quotation is being confirmed and has a source SO, mark the source as QUOTED
        if (data.status === "CONFIRMED" && (existing as any).sourceSalesOrderId) {
            const hasQuotationPrices = data.items?.some((item: any) => item.quotationUnitPrice !== undefined && item.quotationUnitPrice !== null)
                || (existing.items as any[]).some((item: any) => item.quotationUnitPrice != null && Number(item.quotationUnitPrice) > 0);
            if (hasQuotationPrices) {
                await prisma.salesOrder.update({
                    where: { id: Number((existing as any).sourceSalesOrderId) },
                    data: { status: "QUOTED" as any },
                });
            }
        }

        return updated;
    }

    // ─── Delete ──────────────────────────────────────────────────────────────

    async delete(id: number, _permissions: string[] = []) {
        const order = await this.findById(id);
        const status = (order as any).status as string;

        const deletableStatuses = [
            "DRAFT",
            "QUOTATION_IN_PROGRESS",
            "QUOTATION_COMPLETED",
            "PENDING_CUSTOMER_APPROVAL",
            "CUSTOMER_REJECTED",
        ];

        if (!deletableStatuses.includes(status)) {
            throw new ApiError(400, `Cannot delete an order with status "${status}". Confirmed orders cannot be deleted.`);
        }

        const invoiceCount = await prisma.salesInvoice.count({ where: { salesOrderId: id } as any });
        if (invoiceCount > 0) {
            throw new ApiError(400, `Cannot delete sales order: ${invoiceCount} invoice(s) are linked to this order.`);
        }

        await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
        return prisma.salesOrder.delete({ where: { id } });
    }

    // ─── Workflow (status transitions) ───────────────────────────────────────

    private async updateStatus(id: number, newStatus: SalesOrderStatus, _permissions: string[]) {
        const order = await prisma.salesOrder.findUnique({
            where: { id },
            select: { totalDiscount: true, orderDiscountType: true, orderDiscountValue: true },
        });
        const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
        const subtotal  = items.reduce((s, l) => s.add(l.lineTotal),              ZERO);
        const totalCgst = items.reduce((s, l) => s.add((l as any).cgstAmount ?? ZERO), ZERO);
        const totalSgst = items.reduce((s, l) => s.add((l as any).sgstAmount ?? ZERO), ZERO);
        const totalIgst = items.reduce((s, l) => s.add((l as any).igstAmount ?? ZERO), ZERO);
        const totalTax  = totalCgst.add(totalSgst).add(totalIgst);

        // Apply existing discount so netAmount stays correct
        const discount   = order?.totalDiscount ?? ZERO;
        const taxable    = subtotal.sub(discount);
        const discRatio  = subtotal.gt(ZERO) ? taxable.div(subtotal) : new Prisma.Decimal(1);
        const adjustedTax = totalTax.mul(discRatio);

        const updated = await prisma.salesOrder.update({
            where: { id },
            data: {
                status:    newStatus as any,
                subtotal,
                netAmount: taxable.add(adjustedTax),
                totalDiscount: discount,
                totalCgst,
                totalSgst,
                totalIgst,
                totalTax,
            },
            include: INCLUDE_GST,
        });
        return updated;
    }

    async confirmOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const currentStatus = (existing as any).status as string;
        if (!["DRAFT", "QUOTATION_IN_PROGRESS"].includes(currentStatus)) {
            throw new ApiError(409, `Cannot confirm order with status ${currentStatus}`);
        }
        return this.updateStatus(id, "CONFIRMED", permissions);
    }

    async convertToSalesOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const currentStatus = (existing as any).status as string;
        if (!["CUSTOMER_APPROVED", "CONFIRMED"].includes(currentStatus)) {
            throw new ApiError(409, `Cannot convert order with status ${currentStatus} to sales order`);
        }
        const quoteItems = await prisma.salesOrderItem.findMany({
            where: { salesOrderId: id },
            select: { id: true, quotationUnitPrice: true, unitPrice: true },
        });
        for (const item of quoteItems) {
            if (item.quotationUnitPrice !== null) {
                await prisma.salesOrderItem.update({
                    where: { id: item.id },
                    data: { unitPrice: item.quotationUnitPrice },
                });
            }
        }
        return this.updateStatus(id, "QUOTATION_COMPLETED", permissions);
    }

    async getSourceOrders(customerId: string, _permissions: string[] = []) {
        const gstSources = await prisma.salesOrder.findMany({
            where: { customerId, sourceSalesOrderId: { not: null } } as any,
            select: { sourceSalesOrderId: true } as any,
        });
        const usedIds = (gstSources as any[]).map((r: any) => r.sourceSalesOrderId).filter(Boolean) as number[];

        const orders = await prisma.salesOrder.findMany({
            where: {
                customerId,
                status: "CONFIRMED" as any,
                ...(usedIds.length > 0 && { id: { notIn: usedIds } }),
            },
            select: {
                id: true,
                orderNo: true,
                status: true,
                orderDate: true,
                customer: { select: { id: true, firmName: true, displayName: true } },
                items: {
                    select: {
                        productId: true,
                        quantity: true,
                        unitPrice: true,
                        lineTotal: true,
                        product: { select: { id: true, productCode: true, productName: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return orders;
    }

    async markInQuotation(id: number) {
        const order = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!order) throw new ApiError(404, `Sales order with ID ${id} not found`);
        if (order.status !== "CONFIRMED") {
            return { id, status: order.status };
        }
        const updated = await prisma.salesOrder.update({
            where: { id },
            data:  { status: "QUOTATION_IN_PROGRESS" as any },
            select: { id: true, status: true, orderNo: true },
        });
        return updated;
    }

    async getNextSalesOrderCode(_permissions: string[] = []) {
        const year   = new Date().getFullYear();
        const prefix = `SO-${year}-`;

        const lastGst = await prisma.salesOrder.findFirst({
            where:   { orderNo: { startsWith: prefix } },
            orderBy: { id: "desc" },
            select:  { orderNo: true },
        });

        const extractNum = (orderNo: string | null | undefined) => {
            if (!orderNo) return 0;
            const match = orderNo.match(/SO-\d{4}-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        };

        const maxNum = extractNum(lastGst?.orderNo);
        return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
    }

    async getNextQuotationCode(_permissions: string[] = []) {
        const year = new Date().getFullYear();
        const prefix = `QT-${year}-`;
        const lastQuotation = await prisma.salesOrder.findFirst({
            where: { orderNo: { startsWith: prefix } },
            orderBy: { id: "desc" },
            select: { orderNo: true },
        });
        const match = lastQuotation?.orderNo?.match(/QT-\d{4}-(\d+)/);
        const nextNumber = (match ? parseInt(match[1], 10) : 0) + 1;
        return `${prefix}${String(nextNumber).padStart(3, "0")}`;
    }

    async getOrderStatus(id: number, permissions: string[] = []) {
        const order = await this.findById(id, permissions);
        const status = (order as any).status;
        return {
            id:         (order as any).id,
            orderNo:    (order as any).orderNo,
            status,
            canEdit:    ["DRAFT", "CONFIRMED", "QUOTATION_IN_PROGRESS", "QUOTATION_COMPLETED", "PENDING_CUSTOMER_APPROVAL", "CUSTOMER_REJECTED"].includes(status),
            canDelete:  status !== "CONFIRMED",
        };
    }
}

export default new SalesOrderService();
