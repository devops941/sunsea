import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { encryptField, decryptField } from "../../utils/fieldEncryption";
import {
    CreateSalesOrderInput,
    UpdateSalesOrderInput,
    SalesOrderQueryInput,
    SalesOrderStatus,
} from "./sales-order.validation";

// ─── Permission keys ───────────────────────────────────────────────────────────

const PERM_ESTIMATE = "sales-orders.view-estimate";

/**
 * Returns true when the user should read/write the estimated (OrdProcAuxMeta) table.
 * This covers: estimate-only users AND super-admin (has both permissions).
 */
function useEstimatedTable(permissions: string[]): boolean {
    return permissions.includes(PERM_ESTIMATE);
}

// ─── Shared zero constant ──────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);

// ─── Prisma include shapes ─────────────────────────────────────────────────────

/** Include for GST orders (sales_orders → sales_order_items) */
const INCLUDE_GST = {
    items: {
        include: {
            product: { select: { id: true, productCode: true, productName: true } },
            gstTaxRate: { select: { id: true, taxName: true, taxRate: true, taxType: true } },
        },
    },
    customer: { select: { id: true, firmName: true, displayName: true, addresses: true, openingBalance: true, openingBalanceType: true } },
    createdByUser: { select: { userId: true, fullName: true } },
} as const;

/** Include for estimated orders (ord_proc_aux_meta → ord_proc_aux_meta_items) */
const INCLUDE_EST = {
    items: {
        include: {
            product: { select: { id: true, productCode: true, productName: true } },
        },
    },
    customer: { select: { id: true, firmName: true, displayName: true, addresses: true, openingBalance: true, openingBalanceType: true } },
    createdByUser: { select: { userId: true, fullName: true } },
} as const;

// ─── Encryption helpers ────────────────────────────────────────────────────────

/** Safely decrypt a field; returns fallback on failure (avoids crashing on bad/null data). */
function safeDec(value: string | null | undefined, fallback = ""): string {
    if (!value) return fallback;
    try { return decryptField(value); } catch { return fallback; }
}

/**
 * Encrypts the semantic OrdProcAuxMeta fields into their opaque DB column names.
 * Only keys that are present on `data` are included in the returned object.
 */
function encryptEstMeta(data: {
    orderDate?:          Date | string;
    isInterState?:       boolean;
    mobile?:             string | null;
    referenceText?:      string | null;
    narration?:          string | null;
    orderType?:          string | null;
    salesPersonName?:    string | null;
    productionStatus?:   string | null;
    subtotal?:           Prisma.Decimal;
    netAmount?:          Prisma.Decimal;
    totalTax?:           Prisma.Decimal;
    totalCgst?:          Prisma.Decimal;
    totalSgst?:          Prisma.Decimal;
    totalIgst?:          Prisma.Decimal;
    orderDiscountType?:  string | null;
    orderDiscountValue?: Prisma.Decimal | number | null;
}): Record<string, string | null> {
    const enc: Record<string, string | null> = {};

    if ("orderDate" in data && data.orderDate !== undefined) {
        const d = data.orderDate instanceof Date
            ? data.orderDate.toISOString()
            : String(data.orderDate);
        enc.a1 = encryptField(d);
    }
    if ("isInterState" in data && data.isInterState !== undefined) {
        enc.a2 = encryptField(data.isInterState);
    }
    if ("mobile"          in data) enc.a3  = data.mobile          ? encryptField(data.mobile)          : null;
    if ("referenceText"   in data) enc.a4  = data.referenceText   ? encryptField(data.referenceText)   : null;
    if ("narration"       in data) enc.a5  = data.narration       ? encryptField(data.narration)       : null;
    if ("orderType"       in data) enc.a6  = data.orderType       ? encryptField(data.orderType)       : null;
    if ("salesPersonName" in data) enc.a7  = data.salesPersonName ? encryptField(data.salesPersonName) : null;
    if ("productionStatus" in data) enc.a8 = data.productionStatus ? encryptField(data.productionStatus) : null;

    if ("subtotal"  in data && data.subtotal  !== undefined) enc.a9  = encryptField(data.subtotal.toString());
    if ("netAmount" in data && data.netAmount !== undefined) enc.a10 = encryptField(data.netAmount.toString());
    if ("totalTax"  in data && data.totalTax  !== undefined) enc.a11 = encryptField(data.totalTax.toString());
    if ("totalCgst" in data && data.totalCgst !== undefined) enc.a12 = encryptField(data.totalCgst.toString());
    if ("totalSgst" in data && data.totalSgst !== undefined) enc.a13 = encryptField(data.totalSgst.toString());
    if ("totalIgst" in data && data.totalIgst !== undefined) enc.a14 = encryptField(data.totalIgst.toString());

    // a15 = orderDiscountType, a16 = orderDiscountValue (both encrypted)
    if ("orderDiscountType"  in data) enc.a15 = data.orderDiscountType  ? encryptField(data.orderDiscountType)  : null;
    if ("orderDiscountValue" in data) {
        const dv = data.orderDiscountValue;
        enc.a16 = (dv !== null && dv !== undefined) ? encryptField(dv.toString()) : null;
    }

    return enc;
}

/** Returns the zero-set for all financial encrypted columns (used for DRAFT orders). */
function encryptEstMetaZeroFinancials(): Record<string, string> {
    return {
        a9:  encryptField("0"),
        a10: encryptField("0"),
        a11: encryptField("0"),
        a12: encryptField("0"),
        a13: encryptField("0"),
        a14: encryptField("0"),
    };
}

/**
 * Encrypts an estimated order item's numeric fields into opaque DB column names.
 * Non-sensitive FK fields (productId) remain plaintext.
 */
function encryptEstItem(item: {
    productId:   bigint;
    quantity:    Prisma.Decimal;
    rate:        Prisma.Decimal;
    lineTotal:   Prisma.Decimal;
}): { productId: bigint; b1: string; b2: string; b3: string } {
    return {
        productId: item.productId,
        b1: encryptField(item.quantity.toString()),
        b2: encryptField(item.rate.toString()),
        b3: encryptField(item.lineTotal.toString()),
    };
}

/**
 * Decrypts a raw OrdProcAuxMeta DB row (with optional items) into a semantic shape
 * that matches the frontend's expected SalesOrder-like structure.
 */
function decryptEstRow(row: any): any {
    if (!row) return row;

    const decItems = Array.isArray(row.items)
        ? row.items.map((item: any) => ({
            ...item,
            quantity:      new Prisma.Decimal(safeDec(item.b1, "0")),
            estimatedRate: new Prisma.Decimal(safeDec(item.b2, "0")),
            lineTotal:     new Prisma.Decimal(safeDec(item.b3, "0")),
        }))
        : [];

    const rawOrderDate = safeDec(row.a1, "");
    return {
        ...row,
        orderDate:       rawOrderDate ? new Date(rawOrderDate) : null,
        isInterState:    safeDec(row.a2, "false") === "true",
        mobile:          safeDec(row.a3) || null,
        referenceText:   safeDec(row.a4) || null,
        narration:       safeDec(row.a5) || null,
        orderType:       safeDec(row.a6) || null,
        salesPersonName: safeDec(row.a7) || null,
        productionStatus: safeDec(row.a8, "NOT_STARTED") || "NOT_STARTED",
        subtotal:        new Prisma.Decimal(safeDec(row.a9,  "0")),
        netAmount:       new Prisma.Decimal(safeDec(row.a10, "0")),
        totalTax:        new Prisma.Decimal(safeDec(row.a11, "0")),
        totalCgst:       new Prisma.Decimal(safeDec(row.a12, "0")),
        totalSgst:       new Prisma.Decimal(safeDec(row.a13, "0")),
        totalIgst:       new Prisma.Decimal(safeDec(row.a14, "0")),
        orderDiscountType:  safeDec(row.a15) || null,
        orderDiscountValue: row.a16 ? new Prisma.Decimal(safeDec(row.a16, "0")) : null,
        items:           decItems,
    };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type IncomingItem = { productId: string | number | bigint; quantity: number | string };

interface GstItemInput {
    gstTaxRateId?: string | null;
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
     * Builds a map of gstTaxRateId → taxRate so item GST amounts can be derived
     * when the client sends only the gstTaxRateId (no explicit cgst/sgst/igst rates).
     */
    private async buildGstRateMap(items: any[]): Promise<Map<string, Prisma.Decimal>> {
        const ids = [...new Set(
            items.map(i => i.gstTaxRateId).filter((id: any): id is string => Boolean(id))
        )];
        if (ids.length === 0) return new Map();
        const taxes = await prisma.gstTaxRate.findMany({
            where: { id: { in: ids } },
            select: { id: true, taxRate: true },
        });
        return new Map(taxes.map(t => [t.id, new Prisma.Decimal(t.taxRate as any)]));
    }

    /**
     * Fills in cgst/sgst/igst rates from the GST tax master when the item only
     * carries a gstTaxRateId. Intra-state: rate split 50/50 CGST+SGST. Inter-state: full IGST.
     */
    private resolveGstRates(raw: any, gstRateMap: Map<string, Prisma.Decimal>, isInterState: boolean): GstItemInput {
        const hasExplicit = raw.cgstRate != null || raw.sgstRate != null || raw.igstRate != null;
        if (hasExplicit) {
            return { gstTaxRateId: raw.gstTaxRateId, cgstRate: raw.cgstRate, sgstRate: raw.sgstRate, igstRate: raw.igstRate };
        }
        if (!raw.gstTaxRateId) {
            // No GST selection — default to 18% (matches the quotation form default)
            // so sales-order amounts always carry a proper GST breakdown.
            return isInterState
                ? { gstTaxRateId: null, igstRate: 18 }
                : { gstTaxRateId: null, cgstRate: 9, sgstRate: 9 };
        }
        const taxRate = gstRateMap.get(raw.gstTaxRateId);
        if (!taxRate) {
            return { gstTaxRateId: raw.gstTaxRateId, cgstRate: raw.cgstRate, sgstRate: raw.sgstRate, igstRate: raw.igstRate };
        }
        if (isInterState) {
            return { gstTaxRateId: raw.gstTaxRateId, igstRate: taxRate.toNumber() };
        }
        const half = taxRate.div(2).toNumber();
        return { gstTaxRateId: raw.gstTaxRateId, cgstRate: half, sgstRate: half };
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

    async create(data: CreateSalesOrderInput, permissions: string[] = []) {
        if (!data.items || data.items.length === 0) throw new ApiError(400, "At least one item is required");
        this.assertNoDuplicateProducts(data.items);

        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
            include: { customerGrade: { select: { name: true } } },
        });
        if (!customer) throw new ApiError(404, `Customer ${data.customerId} not found`);

        await this.assertProductsExist(data.items.map(i => BigInt(i.productId)));

        // Duplicate orderNo check
        const existingCheck = useEstimatedTable(permissions)
            ? await (prisma as any).ordProcAuxMeta.findUnique({ where: { orderNo: data.orderNo } })
            : await prisma.salesOrder.findUnique({ where: { orderNo: data.orderNo } });
        if (existingCheck) throw new ApiError(409, `Order No "${data.orderNo}" already exists`);

        const lineItems = await this.computeLineTotals(
            data.items.map(i => ({ productId: BigInt(i.productId), quantity: new Prisma.Decimal(i.quantity), unitPrice: (i as any).unitPrice })),
            (customer as any).customerGrade?.name ?? null,
        );

        // ── Estimated users write ONLY to the encrypted ord_proc_aux_meta table ──
        if (useEstimatedTable(permissions)) {
            // Estimated totals: amount-only (Σ lineTotal), no GST — stored encrypted.
            // DRAFT orders keep order totals at ZERO until quotation is submitted/approved.
            const isDraft = data.status === "DRAFT";
            const estSubtotal = isDraft ? ZERO : lineItems.reduce((s, l) => s.add(l.lineTotal), ZERO);
            const encMeta = encryptEstMeta({
                orderDate:          new Date(data.orderDate),
                isInterState:       data.isInterState ?? false,
                mobile:             data.mobile || null,
                referenceText:      data.referenceText || null,
                narration:          data.narration,
                orderType:          data.orderType,
                salesPersonName:    data.salesPersonName || null,
                productionStatus:   "NOT_STARTED",
                subtotal:           estSubtotal,
                netAmount:          estSubtotal,
                totalTax:           ZERO,
                totalCgst:          ZERO,
                totalSgst:          ZERO,
                totalIgst:          ZERO,
                orderDiscountType:  (data as any).orderDiscountType  ?? null,
                orderDiscountValue: (data as any).orderDiscountValue != null
                    ? new Prisma.Decimal((data as any).orderDiscountValue)
                    : null,
            });

            const estOrder = await (prisma as any).ordProcAuxMeta.create({
                data: {
                    orderNo:    data.orderNo,
                    customerId: data.customerId,
                    status:     data.status,
                    createdBy:  data.createdBy,
                    ...encMeta,
                    items: {
                        create: lineItems.map(l => encryptEstItem(l)),
                    },
                },
                include: INCLUDE_EST,
            });
            return { ...decryptEstRow(estOrder), _source: "estimated" };
        }

        // ── GST users write ONLY to the sales_orders table ───────────────────
        const isInterState = data.isInterState ?? false;
        // Derive cgst/sgst/igst rates from the GST tax master when only gstTaxRateId was sent
        const gstRateMap = await this.buildGstRateMap(data.items);
        const itemsWithGst = lineItems.map((l, idx) => {
            const raw = data.items[idx] as any;
            const gstInput = this.resolveGstRates(raw, gstRateMap, isInterState);
            const gst = this.computeGstAmounts(l.lineTotal, gstInput, isInterState);
            return { ...l, gstTaxRateId: raw.gstTaxRateId ?? null, ...gst };
        });

        // DRAFT orders keep order totals at ZERO until quotation is submitted/approved.
        const isDraft = data.status === "DRAFT";
        const createSubtotal  = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.lineTotal),   ZERO);
        const createTotalCgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.cgstAmount),  ZERO);
        const createTotalSgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.sgstAmount),  ZERO);
        const createTotalIgst = isDraft ? ZERO : itemsWithGst.reduce((s, l) => s.add(l.igstAmount),  ZERO);
        const createTotalTax  = createTotalCgst.add(createTotalSgst).add(createTotalIgst);

        // Order-level discount (PERCENT of subtotal, or FLAT amount)
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
                totalTax:  createTotalTax,
                totalCgst: createTotalCgst,
                totalSgst: createTotalSgst,
                totalIgst: createTotalIgst,
                items: {
                    create: itemsWithGst.map(l => ({
                        productId:     l.productId,
                        quantity:      l.quantity,
                        unitPrice:     l.rate,        // ← store effective rate per unit
                        lineTotal:     l.lineTotal,
                        gstTaxRateId:  l.gstTaxRateId,
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

        return { ...gstOrder, _source: "gst" };
    }

    // ─── List ────────────────────────────────────────────────────────────────

    async findAll(query: SalesOrderQueryInput, permissions: string[] = []) {
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

        // GST table — all fields plaintext, full filter support
        const gstWhere = {
            ...(query.customerId    && { customerId: query.customerId }),
            ...(query.status?.length && { status: { in: query.status as SalesOrderStatus[] } }),
            ...(query.orderType     && { orderType: query.orderType }),
            ...searchFilter,
            ...dateFilter,
        };

        // Estimated table — orderDate is encrypted; skip date filter & orderType
        const estWhere = {
            ...(query.customerId    && { customerId: query.customerId }),
            ...(query.status?.length && { status: { in: query.status as SalesOrderStatus[] } }),
            ...searchFilter,
        };

        // Can't sort by encrypted orderDate; fall back to createdAt
        const estSortBy  = query.sortBy === "orderDate" ? "createdAt" : query.sortBy;
        const gstOrderBy = { [query.sortBy]: query.sortOrder };
        const estOrderBy = { [estSortBy]:    query.sortOrder };

        try {
            if (useEstimatedTable(permissions)) {
                const [rows, total] = await Promise.all([
                    (prisma as any).ordProcAuxMeta.findMany({
                        where: estWhere, include: INCLUDE_EST, orderBy: estOrderBy, skip, take: pageSize,
                    }),
                    (prisma as any).ordProcAuxMeta.count({ where: estWhere }),
                ]);
                return {
                    data: rows.map((r: any) => ({ ...decryptEstRow(r), _source: "estimated" })),
                    total, page, pageSize,
                    totalPages: Math.ceil(total / pageSize),
                };
            } else {
                const [rows, total] = await Promise.all([
                    prisma.salesOrder.findMany({
                        where: gstWhere as any, include: INCLUDE_GST as any, orderBy: gstOrderBy, skip, take: pageSize,
                    }),
                    prisma.salesOrder.count({ where: gstWhere as any }),
                ]);
                return {
                    data: rows.map((r: any) => ({ ...r, _source: "gst" })),
                    total, page, pageSize,
                    totalPages: Math.ceil(total / pageSize),
                };
            }
        } catch (err: any) {
            console.error("❌ findAll error:", err?.message || err);
            throw err;
        }
    }

    // ─── Find by ID ──────────────────────────────────────────────────────────

    async findById(id: number, permissions: string[] = []) {
        if (useEstimatedTable(permissions)) {
            const order = await (prisma as any).ordProcAuxMeta.findUnique({
                where: { id },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, productCode: true, productName: true } },
                        },
                    },
                    customer: { include: { customerGrade: true, customerType: true, addresses: true } },
                    createdByUser: { select: { userId: true, fullName: true } },
                },
            });
            if (!order) throw new ApiError(404, `Estimated order with ID ${id} not found`);
            return { ...decryptEstRow(order), _source: "estimated" };
        } else {
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
            return { ...order, _source: "gst" };
        }
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    async update(id: number, data: UpdateSalesOrderInput, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        const existingStatus = (existing as any).status as string;

        if (!["DRAFT", "CONFIRMED", "QUOTATION_IN_PROGRESS", "QUOTATION_COMPLETED", "MD_REJECTED", "CUSTOMER_REJECTED"].includes(existingStatus)) {
            throw new ApiError(409, `Cannot edit order in status ${existingStatus}.`);
        }

        if (useEstimatedTable(permissions)) {
            // ── Estimated update ──────────────────────────────────────────────
            const updateData: Record<string, any> = {};

            // Status is plaintext
            if (data.status !== undefined) updateData.status = data.status;

            // Encrypt scalar field changes (discount fields go through encryptEstMeta as a15/a16)
            const toEncrypt: Parameters<typeof encryptEstMeta>[0] = {};

            if ((data as any).orderDiscountType  !== undefined) toEncrypt.orderDiscountType  = (data as any).orderDiscountType  ?? null;
            if ((data as any).orderDiscountValue !== undefined) {
                toEncrypt.orderDiscountValue = (data as any).orderDiscountValue != null
                    ? new Prisma.Decimal((data as any).orderDiscountValue)
                    : null;
            }
            if (data.mobile             !== undefined) toEncrypt.mobile           = data.mobile || null;
            if ((data as any).salesPersonName !== undefined) toEncrypt.salesPersonName = (data as any).salesPersonName || null;
            if (data.orderType          !== undefined) toEncrypt.orderType        = data.orderType || null;
            if (data.referenceText      !== undefined) toEncrypt.referenceText    = data.referenceText || null;
            if (data.narration          !== undefined) toEncrypt.narration        = data.narration || null;
            if (data.isInterState       !== undefined) toEncrypt.isInterState     = data.isInterState;
            Object.assign(updateData, encryptEstMeta(toEncrypt));

            if (data.items) {
                // New items — recalculate item-level data; order totals stay ZERO until submitForApproval
                this.assertNoDuplicateProducts(data.items);
                await this.assertProductsExist(data.items.map(i => BigInt(i.productId)));

                const lineItems = await this.computeLineTotals(
                    data.items.map(i => ({
                        productId: BigInt(i.productId),
                        quantity:  new Prisma.Decimal(i.quantity),
                        unitPrice: (i as any).unitPrice,
                    })),
                );

                // Always store ZERO for order-level totals; calculated only at submitForApproval
                Object.assign(updateData, encryptEstMetaZeroFinancials());

                await (prisma as any).ordProcAuxMetaItem.deleteMany({ where: { auxMetaId: id } });
                updateData.items = { create: lineItems.map(l => encryptEstItem(l)) };
            }

            const updated = await (prisma as any).ordProcAuxMeta.update({
                where: { id }, data: updateData, include: INCLUDE_EST,
            });
            return { ...decryptEstRow(updated), _source: "estimated" };

        } else {
            // ── GST update ────────────────────────────────────────────────────
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
                // Derive cgst/sgst/igst rates from the GST tax master when only gstTaxRateId was sent
                const updGstRateMap = await this.buildGstRateMap(data.items);
                const itemsWithGst = lineItems.map((l, idx) => {
                    const raw = data.items![idx] as any;
                    const gstInput = this.resolveGstRates(raw, updGstRateMap, isInterState);
                    const gst = this.computeGstAmounts(l.lineTotal, gstInput, isInterState);
                    return { ...l, gstTaxRateId: raw.gstTaxRateId ?? null, ...gst };
                });

                await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

                // Recompute order-level totals so drafts show real amounts in lists.
                const updSubtotal  = itemsWithGst.reduce((s, l) => s.add(l.lineTotal),  ZERO);
                const updTotalCgst = itemsWithGst.reduce((s, l) => s.add(l.cgstAmount), ZERO);
                const updTotalSgst = itemsWithGst.reduce((s, l) => s.add(l.sgstAmount), ZERO);
                const updTotalIgst = itemsWithGst.reduce((s, l) => s.add(l.igstAmount), ZERO);
                const updTotalTax  = updTotalCgst.add(updTotalSgst).add(updTotalIgst);

                // Order-level discount: use the incoming value, else keep the stored one
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
                        unitPrice:     l.rate,        // ← store effective rate per unit
                        lineTotal:     l.lineTotal,
                        gstTaxRateId:  l.gstTaxRateId,
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

            // ── Sync status to estimated table ───────────────────────────────
            try {
                const estUpdateData: Record<string, any> = {};
                if (data.status !== undefined) estUpdateData.status = data.status;
                if (Object.keys(estUpdateData).length > 0) {
                    await (prisma as any).ordProcAuxMeta.updateMany({
                        where: { orderNo: (updated as any).orderNo },
                        data: estUpdateData,
                    });
                }
            } catch (e) { /* ignore */ }

            return { ...updated, _source: "gst" };
        }
    }

    // ─── Delete ──────────────────────────────────────────────────────────────

    async delete(id: number, permissions: string[] = []) {
        if (useEstimatedTable(permissions)) {
            await this.findById(id, permissions);
            return (prisma as any).ordProcAuxMeta.delete({ where: { id } });
        } else {
            await this.findById(id);
            return prisma.salesOrder.delete({ where: { id } });
        }
    }

    // ─── Workflow (status transitions) ───────────────────────────────────────

    private async updateStatus(id: number, newStatus: SalesOrderStatus, permissions: string[]) {
        if (useEstimatedTable(permissions)) {
            const rawItems = await (prisma as any).ordProcAuxMetaItem.findMany({ where: { auxMetaId: id } });
            const subtotal = (rawItems as any[]).reduce((s: Prisma.Decimal, item: any) => {
                return s.add(new Prisma.Decimal(safeDec(item.b3, "0")));
            }, ZERO);
            const encFinancials = encryptEstMeta({
                subtotal,
                netAmount: subtotal,
                totalTax:  ZERO,
                totalCgst: ZERO,
                totalSgst: ZERO,
                totalIgst: ZERO,
            });
            const updated = await (prisma as any).ordProcAuxMeta.update({
                where: { id },
                data:  { status: newStatus, ...encFinancials },
                include: INCLUDE_EST,
            });
            return { ...decryptEstRow(updated), _source: "estimated" };
        } else {
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
            try {
                await (prisma as any).ordProcAuxMeta.updateMany({
                    where: { orderNo: (updated as any).orderNo },
                    data: {
                        status: newStatus,
                        ...encryptEstMeta({
                            subtotal,
                            netAmount: subtotal.add(totalTax),
                            totalTax,
                            totalCgst,
                            totalSgst,
                            totalIgst,
                        }),
                    },
                });
            } catch (e) { /* ignore */ }
            return { ...updated, _source: "gst" };
        }
    }

    async submitForApproval(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if (!["DRAFT", "CONFIRMED", "QUOTATION_IN_PROGRESS", "MD_REJECTED", "CUSTOMER_REJECTED"].includes((existing as any).status)) {
            throw new ApiError(409, `Only DRAFT/CONFIRMED/QUOTATION_IN_PROGRESS orders can be submitted. Current: ${(existing as any).status}`);
        }
        if ((existing as any).items.length === 0) throw new ApiError(400, "Cannot submit an order with no items");

        // ── Calculate financials at quotation-send time ──────────────────────
        if (useEstimatedTable(permissions)) {
            // Read encrypted items → sum line totals → encrypt order totals
            const rawItems = await (prisma as any).ordProcAuxMetaItem.findMany({ where: { auxMetaId: id } });
            const subtotal = (rawItems as any[]).reduce((s: Prisma.Decimal, item: any) => {
                return s.add(new Prisma.Decimal(safeDec(item.b3, "0")));
            }, ZERO);

            // Apply the stored order-level discount (mirrors the GST path logic)
            const estDiscType  = (existing as any).orderDiscountType ?? "PERCENT";
            const estDiscValue = new Prisma.Decimal((existing as any).orderDiscountValue ?? 0);
            const estDiscount  = estDiscValue.lte(0)
                ? ZERO
                : (estDiscType === "FLAT" ? estDiscValue : subtotal.mul(estDiscValue).div(100));
            const estNetAmount = subtotal.sub(estDiscount);

            const encFinancials = encryptEstMeta({
                subtotal,
                netAmount: estNetAmount,
                totalTax:  ZERO,
                totalCgst: ZERO,
                totalSgst: ZERO,
                totalIgst: ZERO,
            });
            const updated = await (prisma as any).ordProcAuxMeta.update({
                where: { id },
                data:  { status: "PENDING_MD_APPROVAL", ...encFinancials },
                include: INCLUDE_EST,
            });
            try {
                await prisma.salesOrder.updateMany({
                    where: { orderNo: (existing as any).orderNo },
                    data: { status: "PENDING_MD_APPROVAL" as any },
                });
            } catch (e) { /* ignore */ }
            return { ...decryptEstRow(updated), _source: "estimated" };

        } else {
            // Read GST items → compute order-level totals → save with new status
            const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
            const subtotal  = items.reduce((s, l) => s.add(l.lineTotal),              ZERO);
            const totalCgst = items.reduce((s, l) => s.add((l as any).cgstAmount ?? ZERO), ZERO);
            const totalSgst = items.reduce((s, l) => s.add((l as any).sgstAmount ?? ZERO), ZERO);
            const totalIgst = items.reduce((s, l) => s.add((l as any).igstAmount ?? ZERO), ZERO);
            const totalTax  = totalCgst.add(totalSgst).add(totalIgst);

            // Preserve the stored order-level discount in the recomputed totals
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
            try {
                await (prisma as any).ordProcAuxMeta.updateMany({
                    where: { orderNo: (updated as any).orderNo },
                    data: {
                        status: "PENDING_MD_APPROVAL",
                        ...encryptEstMeta({
                            subtotal,
                            netAmount: subtotal.add(totalTax),
                            totalTax,
                            totalCgst,
                            totalSgst,
                            totalIgst,
                        }),
                    },
                });
            } catch (e) { /* ignore */ }
            return { ...updated, _source: "gst" };
        }
    }

    async approveOrder(id: number, permissions: string[] = []) {
        const existing = await this.findById(id, permissions);
        if ((existing as any).status !== "PENDING_MD_APPROVAL") {
            throw new ApiError(409, `Order must be in PENDING_MD_APPROVAL status. Current: ${(existing as any).status}`);
        }
        return this.updateStatus(id, "IN_PRODUCTION", permissions);
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
        return this.updateStatus(id, "CONFIRMED", permissions);
    }

    // ─── Next order number ───────────────────────────────────────────────────

    async getNextSalesOrderCode(_permissions: string[] = []) {
        const year   = new Date().getFullYear();
        const prefix = `SO-${year}-`;

        // Check BOTH tables so order numbers never collide
        const [lastGst, lastEst] = await Promise.all([
            prisma.salesOrder.findFirst({
                where:   { orderNo: { startsWith: prefix } },
                orderBy: { id: "desc" },
                select:  { orderNo: true },
            }),
            (prisma as any).ordProcAuxMeta.findFirst({
                where:   { orderNo: { startsWith: prefix } },
                orderBy: { id: "desc" },
                select:  { orderNo: true },
            }).catch(() => null),
        ]);

        const extractNum = (orderNo: string | null | undefined) => {
            if (!orderNo) return 0;
            const match = orderNo.match(/SO-\d{4}-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        };

        const maxNum = Math.max(extractNum(lastGst?.orderNo), extractNum(lastEst?.orderNo));
        return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
    }

    // ─── Order status ────────────────────────────────────────────────────────

    async getOrderStatus(id: number, permissions: string[] = []) {
        const order = await this.findById(id, permissions);
        return {
            id:         (order as any).id,
            orderNo:    (order as any).orderNo,
            status:     (order as any).status,
            _source:    (order as any)._source,
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
