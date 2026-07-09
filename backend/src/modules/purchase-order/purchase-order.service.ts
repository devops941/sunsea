import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from "./purchase-order.validation";

class PurchaseOrderService {

    // ── Generate next PO number ───────────────────────────────────────────────
    async getNextPONumber() {
        const lastPO = await prisma.purchaseOrder.findFirst({
            orderBy: { createdAt: "desc" },
        });

        if (!lastPO) return "PO-001";

        const lastCode = lastPO.poNumber;
        const match = lastCode.match(/\d+/);
        if (!match) return lastCode + "001";

        const numberStr = match[0];
        const nextNumber = parseInt(numberStr, 10) + 1;
        const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
        const prefix = lastCode.substring(0, lastCode.indexOf(numberStr));
        const suffix = lastCode.substring(lastCode.indexOf(numberStr) + numberStr.length);
        return `${prefix}${paddedNumber}${suffix}`;
    }

    // ── Calculate totals from items ───────────────────────────────────────────
    private calculateTotals(items: CreatePurchaseOrderInput["items"]) {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        const itemsWithTotals = items.map((item) => {
            const base = item.quantity * item.unitPrice;
            const discAmount = (base * (item.discount || 0)) / 100;
            const taxAmount = ((base - discAmount) * (item.tax || 0)) / 100;
            const lineTotal = base - discAmount + taxAmount;

            subtotal += base;
            totalDiscount += discAmount;
            totalTax += taxAmount;

            return { ...item, lineTotal };
        });

        return {
            itemsWithTotals,
            subtotal,
            totalDiscount,
            totalTax,
            netAmount: subtotal - totalDiscount + totalTax,
        };
    }

    // ── Create ────────────────────────────────────────────────────────────────
    async createPurchaseOrder(
        data: CreatePurchaseOrderInput,
        currentUser: { userId: string; companyId: string }
    ) {
        // Guard: supplier must exist
        const supplier = await prisma.supplier.findUnique({
            where: { id: Number(data.supplierId) },
        });
        if (!supplier) {
            throw new ApiError(404, `Supplier not found`);
        }

        // Guard: at least one item
        if (!data.items || data.items.length === 0) {
            throw new ApiError(400, "At least one item is required");
        }

        const poNumber = await this.getNextPONumber();
        const { itemsWithTotals, subtotal, totalDiscount, totalTax, netAmount } =
            this.calculateTotals(data.items);

        return prisma.purchaseOrder.create({
            data: {
                poNumber,
                poDate: new Date(data.poDate),
                expectedDeliveryDate: new Date(data.expectedDeliveryDate),
                supplierId: Number(data.supplierId),
                status: data.status || "DRAFT",
                remarks: data.remarks || null,
                sameAsBilling: data.sameAsBilling || false,

                billingAddressLine1: data.billingAddressLine1,
                billingCity: data.billingCity,
                billingState: data.billingState,
                billingPincode: data.billingPincode,

                shippingAddressLine1: data.shippingAddressLine1,
                shippingCity: data.shippingCity,
                shippingState: data.shippingState,
                shippingPincode: data.shippingPincode,

                subtotal,
                totalDiscount,
                totalTax,
                netAmount,

                companyId: currentUser.companyId,
                createdBy: currentUser.userId,

                items: {
                    create: itemsWithTotals.map((item) => ({
                        productId: String(item.productId),
                        uom: item.uom || "",
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount || 0,
                        tax: item.tax || 0,
                        lineTotal: item.lineTotal,
                    })),
                },
            },
            include: { items: true },
        });
    }

    // ── Get all (with optional pagination, search, and status filtering) ──────
    async getAllPurchaseOrders(query?: {
        page?: number;
        pageSize?: number;
        search?: string;
        status?: string;
    }) {
        const page = query?.page;
        const pageSize = query?.pageSize;
        const search = query?.search;
        const status = query?.status;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { poNumber: { contains: search, mode: "insensitive" } },
                { supplier: { legalName: { contains: search, mode: "insensitive" } } },
                { supplier: { displayName: { contains: search, mode: "insensitive" } } },
            ];
        }

        const total = await prisma.purchaseOrder.count({ where });

        const findOptions: any = {
            where,
            orderBy: { createdAt: "desc" },
            include: {
                supplier: {
                    select: {
                        id: true,
                        displayName: true,
                        legalName: true,
                        supplierCode: true,
                    },
                },
                items: true,
            },
        };

        if (page !== undefined && pageSize !== undefined) {
            findOptions.skip = (page - 1) * pageSize;
            findOptions.take = pageSize;
        }

        const pos = await prisma.purchaseOrder.findMany(findOptions);

        const mapped = pos.map((po) => {
            const { supplier, ...rest } = po as any;
            return {
                ...rest,
                supplier: supplier
                    ? {
                        id: supplier.id,
                        supplierCode: supplier.supplierCode,
                        supplierName: supplier.displayName || supplier.legalName,
                    }
                    : null,
            };
        });

        if (page !== undefined && pageSize !== undefined) {
            return {
                data: mapped,
                total,
            };
        }

        return mapped;
    }

    // ── Get by ID ─────────────────────────────────────────────────────────────
    async getPurchaseOrderById(id: string) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: {
                    select: {
                        id: true,
                        displayName: true,
                        legalName: true,
                        supplierCode: true,
                    },
                },
                items: true,
            },
        });

        if (!po) {
            throw new ApiError(404, "Purchase Order not found");
        }

        const { supplier, ...rest } = po as any;
        return {
            ...rest,
            supplier: supplier
                ? {
                    id: supplier.id,
                    supplierCode: supplier.supplierCode,
                    supplierName: supplier.displayName || supplier.legalName,
                }
                : null,
        };
    }

    // ── Update ────────────────────────────────────────────────────────────────
    async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderInput) {
        await this.getPurchaseOrderById(id);

        // Recalculate totals if items are being updated
        const updateData: any = {
            ...(data.poDate && { poDate: new Date(data.poDate) }),
            ...(data.expectedDeliveryDate && { expectedDeliveryDate: new Date(data.expectedDeliveryDate) }),
            ...(data.supplierId && { supplierId: data.supplierId }),
            ...(data.status && { status: data.status }),
            ...(data.remarks !== undefined && { remarks: data.remarks }),
            ...(data.rejectReason !== undefined && { rejectReason: data.rejectReason }),
            ...(data.sameAsBilling !== undefined && { sameAsBilling: data.sameAsBilling }),

            ...(data.billingAddressLine1 !== undefined && { billingAddressLine1: data.billingAddressLine1 }),
            ...(data.billingCity !== undefined && { billingCity: data.billingCity }),
            ...(data.billingState !== undefined && { billingState: data.billingState }),
            ...(data.billingPincode !== undefined && { billingPincode: data.billingPincode }),

            ...(data.shippingAddressLine1 !== undefined && { shippingAddressLine1: data.shippingAddressLine1 }),
            ...(data.shippingCity !== undefined && { shippingCity: data.shippingCity }),
            ...(data.shippingState !== undefined && { shippingState: data.shippingState }),
            ...(data.shippingPincode !== undefined && { shippingPincode: data.shippingPincode }),
        };

        // If items are updated — delete old and recreate
        if (data.items && data.items.length > 0) {
            const { itemsWithTotals, subtotal, totalDiscount, totalTax, netAmount } =
                this.calculateTotals(data.items);

            updateData.subtotal = subtotal;
            updateData.totalDiscount = totalDiscount;
            updateData.totalTax = totalTax;
            updateData.netAmount = netAmount;

            updateData.items = {
                deleteMany: {},                          // delete all old items
                create: itemsWithTotals.map((item) => ({
                    productId: String(item.productId),
                    uom: item.uom || "",
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount || 0,
                    tax: item.tax || 0,
                    lineTotal: item.lineTotal,
                })),
            };
        }

        return prisma.purchaseOrder.update({
            where: { id },
            data: updateData,
            include: { items: true },
        });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    async deletePurchaseOrder(id: string) {
        await this.getPurchaseOrderById(id);

        // Block delete if GRN or invoice is linked
        const linkedGRN = await (prisma as any).goodsReceiptNote?.count({
            where: { purchaseOrderId: id },
        }).catch(() => 0);

        if (linkedGRN && linkedGRN > 0) {
            throw new ApiError(
                409,
                `Cannot delete — ${linkedGRN} Goods Receipt Note(s) are linked to this PO`
            );
        }

        return executeDeleteWithValidation(
            () => prisma.purchaseOrder.delete({ where: { id } }),
            "Purchase Order"
        );
    }
}

export default new PurchaseOrderService();