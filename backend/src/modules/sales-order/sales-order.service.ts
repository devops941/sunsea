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

// ─── Prisma include shape ──────────────────────────────────────────────────────

/** Include for GST orders (sales_orders → sales_order_items) */
const INCLUDE_GST = {
    items: {
        include: {
            product: { select: { id: true, productCode: true, productName: true } },
        },
    },
    customer: { select: { id: true, firmName: true, displayName: true, addresses: true, openingBalance: true, openingBalanceType: true } },
    createdByUser: { select: { userId: true, fullName: true } },
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

type IncomingItem = { productId: string | number | bigint; quantity: number | string };

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
            const key = String(item.productId);
            if (seen.has(key)) dupes.add(key);
            else seen.set(key, 0);
        });
        if (dupes.size > 0) {
            throw new ApiError(400, `Duplicate item(s): ${[...dupes].map(k => `productId=${k}`).join(" | ")}`);
        }
    }

    private async computeLineTotals(
        items: { productId: bigint; quantity: Prisma.Decimal; unitPrice?: Prisma.Decimal | number | string | null }[],
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
            if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== "" && !isNaN(Number(item.unitPrice))) {
                rate = new Prisma.Decimal(item.unitPrice);
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
        return isInterState
            ? { igstRate: 18 }
            : { cgstRate: 9, sgstRate: 9 };
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

        const lineItems = await this.computeLineTotals(
            data.items.map(i => ({ productId: BigInt(i.productId), quantity: new Prisma.Decimal(i.quantity), unitPrice: (i as any).unitPrice })),
            (customer as any).customerGrade?.name ?? null,
        );

        const isInterState = data.isInterState ?? false;
        const itemsWithGst = lineItems.map((l, idx) => {
            const raw = data.items[idx] as any;
            const gstInput = this.resolveGstRates(raw, isInterState);
            const gst = this.computeGstAmounts(l.lineTotal, gstInput, isInterState);
            return { ...l, ...gst };
        });

        const isDraft = data.status === "DRAFT";
        const createSubtotal  = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.lineTotal),   ZERO);
        const createTotalCgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.cgstAmount),  ZERO);
        const createTotalSgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.sgstAmount),  ZERO);
        const createTotalIgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.igstAmount),  ZERO);
        const createTotalTax  = createTotalCgst.add(createTotalSgst).add(createTotalIgst);

        const discountValue = new Prisma.Decimal((data as any).orderDiscountValue ?? 0);
        const createDiscount = isDraft || discountValue.lte(0)
            ? ZERO
            : ((data as any).orderDiscountType === "FLAT"
                ? discountValue
                : createSubtotal.mul(discountValue).div(100));

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
                subtotal:  createSubtotal,
                netAmount: createSubtotal.add(createTotalTax).sub(createDiscount),
                totalDiscount: createDiscount,
                orderDiscountType:  (data as any).orderDiscountType ?? null,
                orderDiscountValue: (data as any).orderDiscountValue ?? null,
                // @ts-ignore
                sourceSalesOrderId: (data as any).sourceSalesOrderId ? Number((data as any).sourceSalesOrderId) : null,
                totalTax:  createTotalTax,
                totalCgst: createTotalCgst,
                totalSgst: createTotalSgst,
                totalIgst: createTotalIgst,
                items: {
                    create: itemsWithGst.map(l => ({
                        productId:     l.productId,
                        quantity:      l.quantity,
                        unitPrice:     l.rate,
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

        return gstOrder;
    }

    // ─── List ────────────────────────────────────────────────────────────────

    async findAll(query: SalesOrderQueryInput, _permissions: string[] = []) {
        const page     = Math.max(1, query.page);
        const pageSize = Math.min(100, Math.max(1, query.pageSize));
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

        const gstWhere = {
            ...(query.customerId    && { customerId: query.customerId }),
            ...(query.status?.length && { status: { in: query.status as SalesOrderStatus[] } }),
            ...(query.orderType     && { orderType: query.orderType }),
            ...searchFilter,
            ...dateFilter,
        };

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
            console.error("❌ findAll error:", err?.message || err);
            throw err;
        }
    }

    // ─── Find by ID ──────────────────────────────────────────────────────────

    async findById(id: number, _permissions: string[] = []) {
        const order = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: { include: { customerGrade: true, customerType: true, addresses: true } },
                items: {
                    include: {
                        product: true,
                        gstTaxRate: { select: { id: true, taxName: true, taxRate: true, taxType: true } },
                    },
                },
                createdByUser: { select: { userId: true, fullName: true } },
            },
        });
        if (!order) throw new ApiError(404, `Sales order with ID ${id} not found`);
        return order;
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    async update(id: number, data: UpdateSalesOrderInput, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const existingStatus = (existing as any).status as string;

        if (!["DRAFT", "CONFIRMED", "QUOTATION_IN_PROGRESS", "QUOTATION_COMPLETED", "MD_REJECTED", "CUSTOMER_REJECTED"].includes(existingStatus)) {
            throw new ApiError(409, `Cannot edit order in status ${existingStatus}.`);
        }

        const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};
        if (data.mobile        !== undefined) updateData.mobile         = data.mobile;
        // @ts-ignore
        if ((data as any).salesPersonName !== undefined) updateData.salesPersonName = (data as any).salesPersonName;
        if (data.orderType     !== undefined) updateData.orderType      = data.orderType;
        if (data.referenceText !== undefined) updateData.referenceText  = data.referenceText;
        if (data.narration     !== undefined) updateData.narration      = data.narration;
        if (data.status        !== undefined) updateData.status         = data.status;
        if (data.isInterState  !== undefined) updateData.isInterState   = data.isInterState;

        if (data.items) {
            this.assertNoDuplicateProducts(data.items);
            await this.assertProductsExist(data.items.map(i => BigInt(i.productId)));

            const lineItems = await this.computeLineTotals(
                data.items.map(i => ({
                    productId: BigInt(i.productId),
                    quantity:  new Prisma.Decimal(i.quantity),
                    unitPrice: (i as any).unitPrice,
                })),
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
            const updDiscValue = new Prisma.Decimal((data as any).orderDiscountValue ?? (existing as any).orderDiscountValue ?? 0);
            const updDiscount  = updDiscValue.lte(0)
                ? ZERO
                : (updDiscType === "FLAT" ? updDiscValue : updSubtotal.mul(updDiscValue).div(100));

            updateData.subtotal  = updSubtotal;
            updateData.netAmount = updSubtotal.add(updTotalTax).sub(updDiscount);
            updateData.totalDiscount = updDiscount;
            if ((data as any).orderDiscountType  !== undefined) updateData.orderDiscountType  = (data as any).orderDiscountType;
            if ((data as any).orderDiscountValue !== undefined) updateData.orderDiscountValue = (data as any).orderDiscountValue;
            updateData.totalCgst = updTotalCgst;
            updateData.totalSgst = updTotalSgst;
            updateData.totalIgst = updTotalIgst;
            updateData.totalTax  = updTotalTax;
            updateData.items = {
                create: itemsWithGst.map(l => ({
                    productId:     l.productId,
                    quantity:      l.quantity,
                    unitPrice:     l.rate,
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
        return updated;
    }

    // ─── Delete ──────────────────────────────────────────────────────────────

    async delete(id: number, _permissions: string[] = []) {
        await this.findById(id);
        return prisma.salesOrder.delete({ where: { id } });
    }

    // ─── Workflow (status transitions) ───────────────────────────────────────

    private async updateStatus(id: number, newStatus: SalesOrderStatus, _permissions: string[]) {
        const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
        const subtotal  = items.reduce((s, l) => s.add(l.lineTotal),              ZERO);
        const totalCgst = items.reduce((s, l) => s.add((l as any).cgstAmount ?? ZERO), ZERO);
        const totalSgst = items.reduce((s, l) => s.add((l as any).sgstAmount ?? ZERO), ZERO);
        const totalIgst = items.reduce((s, l) => s.add((l as any).igstAmount ?? ZERO), ZERO);
        const totalTax  = totalCgst.add(totalSgst).add(totalIgst);
        const updated = await prisma.salesOrder.update({
            where: { id },
            data: {
                status:    newStatus as any,
                subtotal,
                netAmount: subtotal.add(totalTax),
                totalCgst,
                totalSgst,
                totalIgst,
                totalTax,
            },
            include: INCLUDE_GST,
        });
        return updated;
    }

    async submitForApproval(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if (!["DRAFT", "CONFIRMED", "QUOTATION_IN_PROGRESS", "MD_REJECTED", "CUSTOMER_REJECTED"].includes((existing as any).status)) {
            throw new ApiError(409, `Only DRAFT/CONFIRMED/QUOTATION_IN_PROGRESS orders can be submitted. Current: ${(existing as any).status}`);
        }
        if ((existing as any).items.length === 0) throw new ApiError(400, "Cannot submit an order with no items");

        const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
        const subtotal  = items.reduce((s, l) => s.add(l.lineTotal),              ZERO);
        const totalCgst = items.reduce((s, l) => s.add((l as any).cgstAmount ?? ZERO), ZERO);
        const totalSgst = items.reduce((s, l) => s.add((l as any).sgstAmount ?? ZERO), ZERO);
        const totalIgst = items.reduce((s, l) => s.add((l as any).igstAmount ?? ZERO), ZERO);
        const totalTax  = totalCgst.add(totalSgst).add(totalIgst);

        const discType  = (existing as any).orderDiscountType ?? "PERCENT";
        const discValue = new Prisma.Decimal((existing as any).orderDiscountValue ?? 0);
        const discount  = discValue.lte(0)
            ? ZERO
            : (discType === "FLAT" ? discValue : subtotal.mul(discValue).div(100));

        const updated = await prisma.salesOrder.update({
            where: { id },
            data: {
                status:    "PENDING_MD_APPROVAL" as any,
                subtotal,
                netAmount: subtotal.add(totalTax).sub(discount),
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

    async approveOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if ((existing as any).status !== "PENDING_MD_APPROVAL") {
            throw new ApiError(409, `Order must be in PENDING_MD_APPROVAL status. Current: ${(existing as any).status}`);
        }
        return this.updateStatus(id, "MD_APPROVED", permissions);
    }

    async rejectOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if ((existing as any).status !== "PENDING_MD_APPROVAL") {
            throw new ApiError(409, `Order must be in PENDING_MD_APPROVAL status. Current: ${(existing as any).status}`);
        }
        return this.updateStatus(id, "MD_REJECTED", permissions);
    }

    async reopen(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if (!["MD_REJECTED", "CUSTOMER_REJECTED"].includes((existing as any).status)) {
            throw new ApiError(409, `Cannot reopen order with status ${(existing as any).status}`);
        }
        return this.updateStatus(id, "DRAFT", permissions);
    }

    async convertToSalesOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const currentStatus = (existing as any).status as string;
        if (!["MD_APPROVED", "CUSTOMER_APPROVED", "PENDING_MD_APPROVAL"].includes(currentStatus)) {
            throw new ApiError(409, `Cannot convert order with status ${currentStatus} to sales order`);
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

    async getOrderStatus(id: number, permissions: string[] = []) {
        const order = await this.findById(id, permissions);
        return {
            id:         (order as any).id,
            orderNo:    (order as any).orderNo,
            status:     (order as any).status,
            canEdit:               ["DRAFT", "CONFIRMED"].includes((order as any).status),
            canDelete:             (order as any).status === "DRAFT",
            canSubmitForApproval:  ["DRAFT", "CONFIRMED"].includes((order as any).status) && (order as any).items.length > 0,
            canApprove:            (order as any).status === "PENDING_MD_APPROVAL",
            canReject:             (order as any).status === "PENDING_MD_APPROVAL",
            canReopen:             ["MD_REJECTED", "CUSTOMER_REJECTED"].includes((order as any).status),
        };
    }
}

export default new SalesOrderService();
