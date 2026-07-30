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
    private calculateTotals(
        items: CreatePurchaseOrderInput["items"],
        isInterState: boolean,
        poDiscountType: "PERCENT" | "FLAT" = "PERCENT",
        poDiscountValue: number = 0,
        roundingAdjust: number = 0
    ) {
        let subtotal = 0;
        let totalTax = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        const itemsWithTotals = items.map((item) => {
            const qty = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            const lineSubtotal = qty * unitPrice;

            // Taxable amount is the line subtotal (no item-level discount)
            const taxableAmount = lineSubtotal;

            // GST Tax Rate (percentage rate, e.g. 18)
            const totalGstRate = Number(item.tax) || 0;
            const totalGstAmount = (taxableAmount * totalGstRate) / 100;

            let cgstRate = 0;
            let cgstAmount = 0;
            let sgstRate = 0;
            let sgstAmount = 0;
            let igstRate = 0;
            let igstAmount = 0;

            if (isInterState) {
                igstRate = totalGstRate;
                igstAmount = totalGstAmount;
            } else {
                cgstRate = totalGstRate / 2;
                sgstRate = totalGstRate / 2;
                cgstAmount = totalGstAmount / 2;
                sgstAmount = totalGstAmount / 2;
            }

            const lineTotal = taxableAmount + totalGstAmount;

            subtotal += lineSubtotal;
            totalTax += totalGstAmount;
            totalCgst += cgstAmount;
            totalSgst += sgstAmount;
            totalIgst += igstAmount;

            return {
                ...item,
                quantity: qty,
                unitPrice: unitPrice,
                tax: totalGstRate,
                taxableAmount,
                cgstRate,
                cgstAmount,
                sgstRate,
                sgstAmount,
                igstRate,
                igstAmount,
                lineTotal,
                // Zero out legacy item-level discount fields
                discount: 0,
                discountType: "PERCENT" as const,
                discountValue: 0,
                discountAmount: 0,
            };
        });

        let totalDiscount = 0;
        if (poDiscountType === "PERCENT") {
            totalDiscount = (subtotal * poDiscountValue) / 100;
        } else {
            totalDiscount = poDiscountValue;
        }
        if (totalDiscount > subtotal) {
            totalDiscount = subtotal;
        }

        return {
            itemsWithTotals,
            subtotal,
            totalDiscount,
            totalTax,
            totalCgst,
            totalSgst,
            totalIgst,
            netAmount: subtotal - totalDiscount + totalTax + Number(roundingAdjust),
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

        const company = await prisma.company.findUnique({
            where: { id: currentUser.companyId },
        });
        const isInterState = company?.state?.toLowerCase().trim() !== supplier.billingState?.toLowerCase().trim();

        const poNumber = await this.getNextPONumber();
        const poDiscountType = data.discountType || "PERCENT";
        const poDiscountValue = Number(data.discountValue) || 0;
        const roundingAdjust = Number(data.roundingAdjust) || 0;

        const { itemsWithTotals, subtotal, totalDiscount, totalTax, totalCgst, totalSgst, totalIgst, netAmount } =
            this.calculateTotals(data.items, isInterState, poDiscountType, poDiscountValue, roundingAdjust);

        return prisma.purchaseOrder.create({
            data: {
                poNumber,
                poDate: new Date(data.poDate),
                expectedDeliveryDate: new Date(data.expectedDeliveryDate),
                supplierId: Number(data.supplierId),
                storeId: data.storeId || null,
                status: data.status || "DRAFT",
                remarks: data.remarks || null,
                sameAsBilling: data.sameAsBilling ?? false,

                billingAddressLine1: data.billingAddressLine1,
                billingCity: data.billingCity,
                billingState: data.billingState,
                billingPincode: data.billingPincode,
                billingCountry: data.billingCountry || "India",

                shippingAddressLine1: data.shippingAddressLine1,
                shippingCity: data.shippingCity,
                shippingState: data.shippingState,
                shippingPincode: data.shippingPincode,
                shippingCountry: data.shippingCountry || "India",

                subtotal,
                discountType: poDiscountType,
                discountValue: poDiscountValue,
                roundingAdjust,
                totalDiscount,
                totalTax,
                totalCgst,
                totalSgst,
                totalIgst,
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
                        discountType: item.discountType,
                        discountValue: item.discountValue,
                        discountAmount: item.discountAmount,
                        taxableAmount: item.taxableAmount,
                        cgstRate: item.cgstRate,
                        cgstAmount: item.cgstAmount,
                        sgstRate: item.sgstRate,
                        sgstAmount: item.sgstAmount,
                        igstRate: item.igstRate,
                        igstAmount: item.igstAmount,
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
        fromDate?: string;
        toDate?: string;
    }) {
        const page = query?.page;
        const pageSize = query?.pageSize;
        const search = query?.search;
        const status = query?.status;
        const fromDate = query?.fromDate;
        const toDate = query?.toDate;

        const where: any = {};

        if (status) {
            if (status.includes(",")) {
                where.status = { in: status.split(",") };
            } else {
                where.status = status;
            }
        }

        if (fromDate || toDate) {
            where.poDate = {};
            if (fromDate) {
                where.poDate.gte = new Date(fromDate);
            }
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                where.poDate.lte = end;
            }
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
                        email: true,
                        gstin: true,
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
                    email: supplier.email,
                    gstin: supplier.gstin,
                }
                : null,
        };
    }

    // ── Update ────────────────────────────────────────────────────────────────
    async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderInput) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
        });
        if (!po) {
            throw new ApiError(404, "Purchase Order not found");
        }

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
            ...(data.billingCountry !== undefined && { billingCountry: data.billingCountry }),

            ...(data.shippingAddressLine1 !== undefined && { shippingAddressLine1: data.shippingAddressLine1 }),
            ...(data.shippingCity !== undefined && { shippingCity: data.shippingCity }),
            ...(data.shippingState !== undefined && { shippingState: data.shippingState }),
            ...(data.shippingPincode !== undefined && { shippingPincode: data.shippingPincode }),
            ...(data.shippingCountry !== undefined && { shippingCountry: data.shippingCountry }),

            ...(data.storeId !== undefined && { storeId: data.storeId }),
            ...(data.discountType !== undefined && { discountType: data.discountType }),
            ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
        };

        if (data.roundingAdjust !== undefined && (!data.items || data.items.length === 0)) {
            const roundingAdjust = Number(data.roundingAdjust) || 0;
            updateData.roundingAdjust = roundingAdjust;
            updateData.netAmount = Number(po.subtotal) - Number(po.totalDiscount) + Number(po.totalTax) + roundingAdjust;
        }

        // If items are updated — delete old and recreate
        if (data.items && data.items.length > 0) {
            const supplierId = data.supplierId ? Number(data.supplierId) : Number(po.supplierId);
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
            });
            if (!supplier) {
                throw new ApiError(404, `Supplier not found`);
            }

            const company = await prisma.company.findUnique({
                where: { id: po.companyId },
            });
            const isInterState = company?.state?.toLowerCase().trim() !== supplier.billingState?.toLowerCase().trim();

            const poDiscountType = data.discountType !== undefined ? data.discountType : po.discountType;
            const poDiscountValue = data.discountValue !== undefined ? Number(data.discountValue) : Number(po.discountValue || 0);
            const roundingAdjust = data.roundingAdjust !== undefined ? Number(data.roundingAdjust) : Number(po.roundingAdjust || 0);

            const { itemsWithTotals, subtotal, totalDiscount, totalTax, totalCgst, totalSgst, totalIgst, netAmount } =
                this.calculateTotals(data.items, isInterState, poDiscountType as any, poDiscountValue, roundingAdjust);

            updateData.subtotal = subtotal;
            updateData.discountType = poDiscountType;
            updateData.discountValue = poDiscountValue;
            updateData.roundingAdjust = roundingAdjust;
            updateData.totalDiscount = totalDiscount;
            updateData.totalTax = totalTax;
            updateData.totalCgst = totalCgst;
            updateData.totalSgst = totalSgst;
            updateData.totalIgst = totalIgst;
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
                    discountType: item.discountType,
                    discountValue: item.discountValue,
                    discountAmount: item.discountAmount,
                    taxableAmount: item.taxableAmount,
                    cgstRate: item.cgstRate,
                    cgstAmount: item.cgstAmount,
                    sgstRate: item.sgstRate,
                    sgstAmount: item.sgstAmount,
                    igstRate: item.igstRate,
                    igstAmount: item.igstAmount,
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