import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateGrnInvoiceInput, UpdateGrnInvoiceInput } from "./grn-invoice.validation";
import { uploadToImageKit } from "../../utils/Imagekit";
import fs from "fs";
import path from "path";
import crypto from "crypto";

class GrnInvoiceService {

    // ── Generate next GRN number ───────────────────────────────────────────────
    async getNextGrnNumber() {
        const currentYear = new Date().getFullYear();
        const prefix = `GRN-${currentYear}-`;
        const lastGRN = await prisma.grnInvoice.findFirst({
            where: {
                grnNumber: {
                    startsWith: prefix,
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (!lastGRN) return `${prefix}001`;

        const lastCode = lastGRN.grnNumber;
        const match = lastCode.match(/(\d+)$/);
        if (!match) return lastCode + "-001";

        const numberStr = match[0];
        const nextNumber = parseInt(numberStr, 10) + 1;
        const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
        return `${prefix}${paddedNumber}`;
    }

    // ── Calculate totals ────────────────────────────────────────────────────────
    private calculateTotals(
        items: CreateGrnInvoiceInput["items"],
        isInterState: boolean,
        discountType: "PERCENT" | "FLAT" = "PERCENT",
        discountValue: number = 0,
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
            const itemDiscountAmount = Number((item as any).discountAmount || 0);
            const lineSubtotal = (qty * unitPrice) - itemDiscountAmount;

            const taxableAmount = lineSubtotal;
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
                discountAmount: itemDiscountAmount,
                tax: totalGstRate,
                taxableAmount,
                cgstRate,
                cgstAmount,
                sgstRate,
                sgstAmount,
                igstRate,
                igstAmount,
                lineTotal,
            };
        });

        let totalDiscount = 0;
        if (discountType === "PERCENT") {
            totalDiscount = (subtotal * discountValue) / 100;
        } else {
            totalDiscount = discountValue;
        }
        if (totalDiscount > subtotal) {
            totalDiscount = subtotal;
        }

        const netAmount = subtotal - totalDiscount + totalTax + Number(roundingAdjust);

        return {
            itemsWithTotals,
            subtotal,
            totalDiscount,
            totalTax,
            totalCgst,
            totalSgst,
            totalIgst,
            netAmount,
        };
    }

    // ── Create ──────────────────────────────────────────────────────────────────
    async createGrnInvoice(
        data: CreateGrnInvoiceInput,
        currentUser: { userId: string; companyId: string },
        file?: Express.Multer.File
    ) {
        // Validate supplier
        const supplier = await prisma.supplier.findUnique({
            where: { id: Number(data.supplierId) },
        });
        if (!supplier) {
            throw new ApiError(404, "Supplier not found");
        }

        // Validate store
        const store = await prisma.store.findUnique({
            where: { storeId: data.storeId },
        });
        if (!store) {
            throw new ApiError(404, "Store not found");
        }

        // Validate company
        const company = await prisma.company.findUnique({
            where: { id: currentUser.companyId },
        });
        const isInterState = company?.state?.toLowerCase().trim() !== supplier.billingState?.toLowerCase().trim();

        const grnNumber = await this.getNextGrnNumber();
        const discountType = data.discountType || "PERCENT";
        const discountValue = Number(data.discountValue) || 0;
        const roundingAdjust = Number(data.roundingAdjust) || 0;

        const items = typeof data.items === "string" ? JSON.parse(data.items) : data.items;
        const sameAsBilling = (data.sameAsBilling as any) === "true" || data.sameAsBilling === true;

        const { itemsWithTotals, subtotal, totalDiscount, totalTax, totalCgst, totalSgst, totalIgst, netAmount } =
            this.calculateTotals(items, isInterState, discountType, discountValue, roundingAdjust);

        // Upload invoice image to ImageKit if provided
        let invoiceImageUrl: string | null = null;
        if (file) {
            const uniqueName = `invoice_${Date.now()}${path.extname(file.originalname)}`;
            try {
                invoiceImageUrl = await uploadToImageKit(file.buffer, uniqueName, "/invoices");
            } catch (err) {
                console.error("Failed to upload invoice copy to ImageKit:", err);
                throw err;
            }
        }

        const updateStockEnabled = data.updateStock === true || (data.updateStock as any) === "true";

        const rawPayments = typeof (data as any).payments === "string" ? JSON.parse((data as any).payments) : ((data as any).payments || []);
        const processedPayments = rawPayments.map((p: any) => ({
            id: p.id || crypto.randomUUID(),
            amount: Math.round(Number(p.amount) * 100) / 100,
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber || "",
            paymentDate: p.paymentDate,
            recordedBy: currentUser.userId,
            createdAt: new Date().toISOString()
        }));
        const totalPaid = Math.round(processedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) * 100) / 100;
        const computedStatus = totalPaid === 0 ? "Unpaid" : (totalPaid >= Number(netAmount) ? "Closed" : "Partial");

        const lastPayment = processedPayments[processedPayments.length - 1];
        const paymentMethod = lastPayment ? lastPayment.paymentMethod : null;
        const referenceNumber = lastPayment ? lastPayment.referenceNumber : null;
        const paymentDate = lastPayment ? new Date(lastPayment.paymentDate) : null;

        const grnInvoice = await prisma.$transaction(async (tx) => {
            // Create GRN Invoice
            const grnInvoice = await tx.grnInvoice.create({
                data: {
                    grnNumber,
                    invoiceNo: data.invoiceNo,
                    grnDate: new Date(data.grnDate),
                    supplierId: Number(data.supplierId),
                    storeId: data.storeId,
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
                    sameAsBilling,

                    receiveDate: data.receiveDate ? new Date(data.receiveDate) : null,
                    billDueDate: data.billDueDate ? new Date(data.billDueDate) : null,
                    challanNo: data.challanNo || null,
                    transport: data.transport || null,
                    eWayBill: data.eWayBill || null,
                    invoiceImage: invoiceImageUrl || null,
                    remarks: data.remarks || null,

                    discountType,
                    discountValue,
                    roundingAdjust,

                    paymentStatus: computedStatus,
                    paymentMethod,
                    referenceNumber,
                    paymentDate,
                    payments: processedPayments as any,

                    subtotal,
                    totalDiscount,
                    totalTax,
                    totalCgst,
                    totalSgst,
                    totalIgst,
                    netAmount,

                    companyId: currentUser.companyId,
                    createdBy: currentUser.userId,
                    poId: data.poId || null,
                    updateStock: updateStockEnabled,

                    items: {
                        create: itemsWithTotals.map((item) => ({
                            productId: item.productId,
                            description: item.description,
                            uom: item.uom,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discountAmount: item.discountAmount || 0,
                            tax: item.tax || 0,
                            taxableAmount: item.taxableAmount || 0,
                            cgstRate: item.cgstRate || 0,
                            cgstAmount: item.cgstAmount || 0,
                            sgstRate: item.sgstRate || 0,
                            sgstAmount: item.sgstAmount || 0,
                            igstRate: item.igstRate || 0,
                            igstAmount: item.igstAmount || 0,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
                include: {
                    items: true,
                },
            });

            if (updateStockEnabled) {
                const adjustmentNumber = `ADJ-GRN-${grnNumber}`;
                const adjustmentItems = [];

                for (const item of itemsWithTotals) {
                    const rawMaterial = await tx.rawMaterial.findUnique({
                        where: { rawMaterialId: item.productId },
                    });
                    if (!rawMaterial) {
                        throw new ApiError(404, `Raw Material ${item.productId} not found`);
                    }

                    let itemTypeStr = rawMaterial.itemType;
                    if (!itemTypeStr) {
                        itemTypeStr = "Raw Material";
                        await tx.rawMaterial.update({
                            where: { rawMaterialId: item.productId },
                            data: {
                                itemType: "Raw Material",
                                flaggedForReview: true
                            }
                        });
                    }

                    let enumType: any = "RAW_MATERIAL";
                    const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                    if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                        enumType = "RAW_MATERIAL";
                    } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                        enumType = "FINISHED_GOODS";
                    } else if (normalized === "SEMI_FINISHED") {
                        enumType = "SEMI_FINISHED";
                    } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                        enumType = "CONSUMABLE";
                    }

                    const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                    const receivedQtyNum = Number(item.quantity);
                    const adjustedQtyNum = currentQtyNum + receivedQtyNum;

                    adjustmentItems.push({
                        itemType: enumType,
                        rawMaterialId: item.productId,
                        storeId: data.storeId,
                        currentQty: currentQtyNum,
                        adjustedQty: adjustedQtyNum,
                        difference: receivedQtyNum,
                        unitCost: Number(item.unitPrice),
                        batchNo: rawMaterial.batchNo || null,
                        remarks: `Auto-received from GRN ${grnNumber}`
                    });

                    await tx.rawMaterial.update({
                        where: { rawMaterialId: item.productId },
                        data: {
                            onHandQty: {
                                increment: receivedQtyNum,
                            },
                            lastMovementAt: new Date(),
                        },
                    });

                    await tx.rawMaterialTransaction.create({
                        data: {
                            storeId: data.storeId,
                            rawMaterialId: item.productId,
                            txnType: "RECEIPT",
                            qty: receivedQtyNum,
                            txnDateTime: new Date(data.grnDate),
                            remarks: `GRN Created (Auto Adjustment): ${grnNumber}`,
                        },
                    });
                }

                await tx.stockAdjustment.create({
                    data: {
                        adjustmentNumber,
                        adjustmentDate: new Date(data.grnDate),
                        reason: `Auto-generated on Bill Creation for Invoice: ${data.invoiceNo}`,
                        status: "APPROVED",
                        approvedBy: currentUser.userId,
                        approvedAt: new Date(),
                        createdBy: currentUser.userId,
                        updatedBy: currentUser.userId,
                        autoGenerated: true,
                        sourceDocument: "GrnInvoice",
                        sourceDocId: grnInvoice.id,
                        type: "Receipt",
                        items: {
                            create: adjustmentItems
                        }
                    }
                });
            }

            // Update Purchase Order items receivedQty and recalculate PO status
            if (data.poId) {
                const po = await tx.purchaseOrder.findUnique({
                    where: { id: data.poId },
                    include: { items: true },
                });
                if (!po) {
                    throw new ApiError(404, "Purchase Order not found");
                }

                let allFullyReceived = true;
                let hasPartialReceived = false;

                for (const poItem of po.items) {
                    const item = itemsWithTotals.find((i) => i.productId === poItem.productId);
                    const currentRec = Number(poItem.receivedQty) || 0;
                    const addedRec = item ? Number(item.quantity) : 0;
                    const newRec = currentRec + addedRec;

                    if (addedRec > 0) {
                        await tx.purchaseOrderItem.update({
                            where: { id: poItem.id },
                            data: { receivedQty: newRec },
                        });
                    }

                    if (newRec < Number(poItem.quantity)) {
                        allFullyReceived = false;
                    }
                    if (newRec > 0) {
                        hasPartialReceived = true;
                    }
                }

                const newStatus = allFullyReceived
                    ? "CLOSED"
                    : hasPartialReceived
                        ? "PARTIALLY_RECEIVED"
                        : "OPEN";

                await tx.purchaseOrder.update({
                    where: { id: data.poId },
                    data: { status: newStatus },
                });
            }

            return grnInvoice;
        }, { timeout: 30000, maxWait: 10000 });

        // Auto-post double-entry PURCHASE Voucher & PAYMENT Vouchers after GRN transaction has committed
        try {
            const { voucherPostingService } = require("../accounts/voucherPosting.service");
            await voucherPostingService.postPurchaseVoucher(grnInvoice.id);
            await voucherPostingService.postPaymentVouchersForGRN(grnInvoice.id);
        } catch (vErr) {
            console.error("[Auto-Post Voucher Error] Failed to post Purchase/Payment Voucher for GRN:", vErr);
        }

        return grnInvoice;
    }

    // ── Get All ─────────────────────────────────────────────────────────────────
    async getAllGrnInvoices(params: {
        page?: number;
        pageSize?: number;
        search?: string;
        supplierId?: number;
        storeId?: string;
    }) {
        const page = params.page || 1;
        const pageSize = params.pageSize || 10;
        const skip = (page - 1) * pageSize;

        const where: any = {};

        if (params.search) {
            where.OR = [
                { grnNumber: { contains: params.search, mode: "insensitive" } },
                { invoiceNo: { contains: params.search, mode: "insensitive" } },
            ];
        }

        if (params.supplierId) {
            where.supplierId = params.supplierId;
        }

        if (params.storeId) {
            where.storeId = params.storeId;
        }

        const [data, total] = await Promise.all([
            prisma.grnInvoice.findMany({
                where,
                skip,
                take: pageSize,
                include: {
                    supplier: {
                        select: {
                            id: true,
                            supplierCode: true,
                            displayName: true,
                            legalName: true,
                        },
                    },
                    store: {
                        select: {
                            storeId: true,
                            storeName: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.grnInvoice.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    // ── Get By ID ───────────────────────────────────────────────────────────────
    async getGrnInvoiceById(id: string) {
        const grnInvoice = await prisma.grnInvoice.findUnique({
            where: { id },
            include: {
                supplier: true,
                store: true,
                items: {
                    include: {
                        rawMaterial: true,
                    },
                },
                purchaseOrder: true,
            },
        });

        if (!grnInvoice) {
            throw new ApiError(404, "GRN Invoice not found");
        }

        return grnInvoice;
    }

    async updateGrnInvoice(id: string, data: UpdateGrnInvoiceInput, file?: Express.Multer.File) {
        const existing = await prisma.grnInvoice.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!existing) {
            throw new ApiError(404, "GRN Invoice not found");
        }

        const items = data.items ? (typeof data.items === "string" ? JSON.parse(data.items) : data.items) : undefined;
        const sameAsBilling = data.sameAsBilling !== undefined ? ((data.sameAsBilling as any) === "true" || data.sameAsBilling === true) : undefined;

        const supplierId = data.supplierId ? Number(data.supplierId) : existing.supplierId;
        const storeId = data.storeId || existing.storeId;

        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
        });
        if (!supplier) {
            throw new ApiError(404, "Supplier not found");
        }

        const company = await prisma.company.findFirst();
        const isInterState = company?.state?.toLowerCase().trim() !== supplier.billingState?.toLowerCase().trim();

        const discountType = data.discountType || existing.discountType;
        const discountValue = data.discountValue !== undefined ? Number(data.discountValue) : Number(existing.discountValue);
        const roundingAdjust = data.roundingAdjust !== undefined ? Number(data.roundingAdjust) : Number(existing.roundingAdjust);

        // Upload invoice image to ImageKit if provided
        let invoiceImageUrl = existing.invoiceImage;
        if (file) {
            const uniqueName = `invoice_${Date.now()}${path.extname(file.originalname)}`;
            try {
                invoiceImageUrl = await uploadToImageKit(file.buffer, uniqueName, "/invoices");
            } catch (err) {
                console.error("Failed to upload invoice copy to ImageKit:", err);
                throw err;
            }
        }

        const updateStockEnabled = data.updateStock !== undefined
            ? (data.updateStock === true || (data.updateStock as any) === "true")
            : existing.updateStock;

        const rawPayments = data.payments ? (typeof data.payments === "string" ? JSON.parse(data.payments) : data.payments) : undefined;

        const updated = await prisma.$transaction(async (tx) => {
            let subtotal = Number(existing.subtotal);
            let totalDiscount = Number(existing.totalDiscount);
            let totalTax = Number(existing.totalTax);
            let totalCgst = Number(existing.totalCgst);
            let totalSgst = Number(existing.totalSgst);
            let totalIgst = Number(existing.totalIgst);
            let netAmount = Number(existing.netAmount);

            let itemsToCreate = existing.items;

            if (items) {
                const totals = this.calculateTotals(items, isInterState, discountType, discountValue, roundingAdjust);
                subtotal = totals.subtotal;
                totalDiscount = totals.totalDiscount;
                totalTax = totals.totalTax;
                totalCgst = totals.totalCgst;
                totalSgst = totals.totalSgst;
                totalIgst = totals.totalIgst;
                netAmount = totals.netAmount;
                itemsToCreate = totals.itemsWithTotals as any;

                // Delete old items
                await tx.grnInvoiceItem.deleteMany({
                    where: { grnInvoiceId: id },
                });
            }

            let processedPayments = existing.payments ? (typeof existing.payments === "string" ? JSON.parse(existing.payments) : existing.payments) as any[] : [];
            let computedStatus = existing.paymentStatus;

            if (rawPayments) {
                processedPayments = rawPayments.map((p: any) => ({
                    id: p.id || crypto.randomUUID(),
                    amount: Math.round(Number(p.amount) * 100) / 100,
                    paymentMethod: p.paymentMethod,
                    referenceNumber: p.referenceNumber || "",
                    paymentDate: p.paymentDate,
                    recordedBy: "System",
                    createdAt: p.createdAt || new Date().toISOString()
                }));
                const totalPaid = Math.round(processedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) * 100) / 100;
                computedStatus = totalPaid === 0 ? "Unpaid" : (totalPaid >= Number(netAmount) ? "Closed" : "Partial");
            }

            // Update GRN record
            const updated = await tx.grnInvoice.update({
                where: { id },
                data: {
                    invoiceNo: data.invoiceNo || existing.invoiceNo,
                    grnDate: data.grnDate ? new Date(data.grnDate) : existing.grnDate,
                    supplierId,
                    storeId,
                    billingAddressLine1: data.billingAddressLine1 || existing.billingAddressLine1,
                    billingCity: data.billingCity || existing.billingCity,
                    billingState: data.billingState || existing.billingState,
                    billingPincode: data.billingPincode || existing.billingPincode,
                    billingCountry: data.billingCountry || existing.billingCountry || "India",
                    shippingAddressLine1: data.shippingAddressLine1 || existing.shippingAddressLine1,
                    shippingCity: data.shippingCity || existing.shippingCity,
                    shippingState: data.shippingState || existing.shippingState,
                    shippingPincode: data.shippingPincode || existing.shippingPincode,
                    shippingCountry: data.shippingCountry || existing.shippingCountry || "India",
                    sameAsBilling: sameAsBilling ?? existing.sameAsBilling,
                    updateStock: updateStockEnabled,

                    receiveDate: data.receiveDate ? new Date(data.receiveDate) : existing.receiveDate,
                    billDueDate: data.billDueDate ? new Date(data.billDueDate) : existing.billDueDate,
                    challanNo: data.challanNo !== undefined ? data.challanNo : existing.challanNo,
                    transport: data.transport !== undefined ? data.transport : existing.transport,
                    eWayBill: data.eWayBill !== undefined ? data.eWayBill : existing.eWayBill,
                    invoiceImage: file ? invoiceImageUrl : (data.invoiceImage !== undefined ? data.invoiceImage : existing.invoiceImage),
                    remarks: data.remarks !== undefined ? data.remarks : existing.remarks,

                    discountType,
                    discountValue,
                    roundingAdjust,

                    paymentStatus: computedStatus,
                    payments: processedPayments as any,
                    paymentMethod: rawPayments && processedPayments.length > 0 ? processedPayments[processedPayments.length - 1].paymentMethod : (data.paymentMethod !== undefined ? data.paymentMethod : existing.paymentMethod),
                    referenceNumber: rawPayments && processedPayments.length > 0 ? processedPayments[processedPayments.length - 1].referenceNumber : (data.referenceNumber !== undefined ? data.referenceNumber : existing.referenceNumber),
                    paymentDate: rawPayments && processedPayments.length > 0 ? new Date(processedPayments[processedPayments.length - 1].paymentDate) : (data.paymentDate ? new Date(data.paymentDate) : existing.paymentDate),

                    subtotal,
                    totalDiscount,
                    totalTax,
                    totalCgst,
                    totalSgst,
                    totalIgst,
                    netAmount,
                    poId: data.poId !== undefined ? data.poId : existing.poId,

                    ...(data.items && {
                        items: {
                            create: itemsToCreate.map((item: any) => ({
                                productId: item.productId,
                                description: item.description,
                                uom: item.uom,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discountAmount: item.discountAmount || 0,
                                tax: item.tax || 0,
                                taxableAmount: item.taxableAmount || 0,
                                cgstRate: item.cgstRate || 0,
                                cgstAmount: item.cgstAmount || 0,
                                sgstRate: item.sgstRate || 0,
                                sgstAmount: item.sgstAmount || 0,
                                igstRate: item.igstRate || 0,
                                igstAmount: item.igstAmount || 0,
                                lineTotal: item.lineTotal,
                            })),
                        },
                    }),
                },
                include: {
                    items: true,
                },
            });

            // Handle transitions
            if (existing.updateStock && !updateStockEnabled) {
                // Toggle reversed: Revert old stock levels using a Reversal stock adjustment
                const revAdjustmentNumber = `ADJ-REV-${existing.grnNumber}-${Date.now().toString().slice(-4)}`;
                const revAdjustmentItems = [];

                for (const item of existing.items) {
                    const rawMaterial = await tx.rawMaterial.findUnique({
                        where: { rawMaterialId: item.productId },
                    });
                    if (!rawMaterial) continue;

                    let itemTypeStr = rawMaterial.itemType || "Raw Material";
                    let enumType: any = "RAW_MATERIAL";
                    const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                    if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                        enumType = "RAW_MATERIAL";
                    } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                        enumType = "FINISHED_GOODS";
                    } else if (normalized === "SEMI_FINISHED") {
                        enumType = "SEMI_FINISHED";
                    } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                        enumType = "CONSUMABLE";
                    }

                    const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                    const revertQtyNum = Number(item.quantity);
                    const adjustedQtyNum = currentQtyNum - revertQtyNum;

                    revAdjustmentItems.push({
                        itemType: enumType,
                        rawMaterialId: item.productId,
                        storeId: existing.storeId,
                        currentQty: currentQtyNum,
                        adjustedQty: adjustedQtyNum,
                        difference: -revertQtyNum,
                        unitCost: Number(item.unitPrice),
                        batchNo: rawMaterial.batchNo || null,
                        remarks: `Reversal of GRN ${existing.grnNumber} due to update stock disabled`
                    });

                    await tx.rawMaterial.update({
                        where: { rawMaterialId: item.productId },
                        data: {
                            onHandQty: {
                                decrement: revertQtyNum,
                            },
                        },
                    });

                    await tx.rawMaterialTransaction.create({
                        data: {
                            storeId: existing.storeId,
                            rawMaterialId: item.productId,
                            txnType: "STOCK_ADJUSTMENT_OUT",
                            qty: revertQtyNum,
                            txnDateTime: new Date(),
                            remarks: `GRN Reversal: ${existing.grnNumber}`,
                        },
                    });
                }

                if (revAdjustmentItems.length > 0) {
                    await tx.stockAdjustment.create({
                        data: {
                            adjustmentNumber: revAdjustmentNumber,
                            adjustmentDate: new Date(),
                            reason: `Auto-generated Reversal due to Update Stock disabled on Bill: ${existing.invoiceNo}`,
                            status: "APPROVED",
                            approvedBy: existing.createdBy,
                            approvedAt: new Date(),
                            createdBy: existing.createdBy,
                            updatedBy: existing.createdBy,
                            autoGenerated: true,
                            sourceDocument: "GrnInvoice",
                            sourceDocId: existing.id,
                            type: "Reversal",
                            items: {
                                create: revAdjustmentItems
                            }
                        }
                    });
                }
            } else if (!existing.updateStock && updateStockEnabled) {
                // Toggle enabled: Apply stock levels using a Receipt stock adjustment
                const newAdjustmentNumber = `ADJ-GRN-${existing.grnNumber}-${Date.now().toString().slice(-4)}`;
                const newAdjustmentItems = [];

                for (const item of itemsToCreate) {
                    const rawMaterial = await tx.rawMaterial.findUnique({
                        where: { rawMaterialId: item.productId },
                    });
                    if (!rawMaterial) {
                        throw new ApiError(404, `Raw Material ${item.productId} not found`);
                    }

                    let itemTypeStr = rawMaterial.itemType;
                    if (!itemTypeStr) {
                        itemTypeStr = "Raw Material";
                        await tx.rawMaterial.update({
                            where: { rawMaterialId: item.productId },
                            data: {
                                itemType: "Raw Material",
                                flaggedForReview: true
                            }
                        });
                    }

                    let enumType: any = "RAW_MATERIAL";
                    const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                    if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                        enumType = "RAW_MATERIAL";
                    } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                        enumType = "FINISHED_GOODS";
                    } else if (normalized === "SEMI_FINISHED") {
                        enumType = "SEMI_FINISHED";
                    } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                        enumType = "CONSUMABLE";
                    }

                    const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                    const newQtyNum = Number(item.quantity);
                    const adjustedQtyNum = currentQtyNum + newQtyNum;

                    newAdjustmentItems.push({
                        itemType: enumType,
                        rawMaterialId: item.productId,
                        storeId: storeId,
                        currentQty: currentQtyNum,
                        adjustedQty: adjustedQtyNum,
                        difference: newQtyNum,
                        unitCost: Number(item.unitPrice),
                        batchNo: rawMaterial.batchNo || null,
                        remarks: `Receipt from GRN ${existing.grnNumber} after update stock enabled`
                    });

                    await tx.rawMaterial.update({
                        where: { rawMaterialId: item.productId },
                        data: {
                            onHandQty: {
                                increment: newQtyNum,
                            },
                            lastMovementAt: new Date(),
                        },
                    });

                    await tx.rawMaterialTransaction.create({
                        data: {
                            storeId: storeId,
                            rawMaterialId: item.productId,
                            txnType: "RECEIPT",
                            qty: newQtyNum,
                            txnDateTime: new Date(data.grnDate || existing.grnDate),
                            remarks: `GRN Created (Auto Adjustment): ${existing.grnNumber}`,
                        },
                    });
                }

                if (newAdjustmentItems.length > 0) {
                    await tx.stockAdjustment.create({
                        data: {
                            adjustmentNumber: newAdjustmentNumber,
                            adjustmentDate: new Date(data.grnDate || existing.grnDate),
                            reason: `Auto-generated on Update Stock enabled for Bill: ${data.invoiceNo || existing.invoiceNo}`,
                            status: "APPROVED",
                            approvedBy: existing.createdBy,
                            approvedAt: new Date(),
                            createdBy: existing.createdBy,
                            updatedBy: existing.createdBy,
                            autoGenerated: true,
                            sourceDocument: "GrnInvoice",
                            sourceDocId: existing.id,
                            type: "Receipt",
                            items: {
                                create: newAdjustmentItems
                            }
                        }
                    });
                }
            } else if (existing.updateStock && updateStockEnabled) {
                // Both true: only update if there are changes
                let itemsChanged = false;
                if (items) {
                    if (existing.items.length !== itemsToCreate.length) {
                        itemsChanged = true;
                    } else {
                        for (const oldItem of existing.items) {
                            const newItem = itemsToCreate.find(i => i.productId === oldItem.productId);
                            if (!newItem || Number(newItem.quantity) !== Number(oldItem.quantity) || Number(newItem.unitPrice) !== Number(oldItem.unitPrice)) {
                                itemsChanged = true;
                                break;
                            }
                        }
                    }
                }
                const storeChanged = data.storeId !== undefined && data.storeId !== existing.storeId;
                const dateChanged = data.grnDate !== undefined && new Date(data.grnDate).getTime() !== new Date(existing.grnDate).getTime();

                if (itemsChanged || storeChanged || dateChanged) {
                    // Revert old stock levels
                    const revAdjustmentNumber = `ADJ-REV-${existing.grnNumber}-${Date.now().toString().slice(-4)}`;
                    const revAdjustmentItems = [];

                    for (const item of existing.items) {
                        const rawMaterial = await tx.rawMaterial.findUnique({
                            where: { rawMaterialId: item.productId },
                        });
                        if (!rawMaterial) continue;

                        let itemTypeStr = rawMaterial.itemType || "Raw Material";
                        let enumType: any = "RAW_MATERIAL";
                        const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                        if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                            enumType = "RAW_MATERIAL";
                        } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                            enumType = "FINISHED_GOODS";
                        } else if (normalized === "SEMI_FINISHED") {
                            enumType = "SEMI_FINISHED";
                        } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                            enumType = "CONSUMABLE";
                        }

                        const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                        const revertQtyNum = Number(item.quantity);
                        const adjustedQtyNum = currentQtyNum - revertQtyNum;

                        revAdjustmentItems.push({
                            itemType: enumType,
                            rawMaterialId: item.productId,
                            storeId: existing.storeId,
                            currentQty: currentQtyNum,
                            adjustedQty: adjustedQtyNum,
                            difference: -revertQtyNum,
                            unitCost: Number(item.unitPrice),
                            batchNo: rawMaterial.batchNo || null,
                            remarks: `Reversal of GRN ${existing.grnNumber} due to update`
                        });

                        await tx.rawMaterial.update({
                            where: { rawMaterialId: item.productId },
                            data: {
                                onHandQty: {
                                    decrement: revertQtyNum,
                                },
                            },
                        });

                        await tx.rawMaterialTransaction.create({
                            data: {
                                storeId: existing.storeId,
                                rawMaterialId: item.productId,
                                txnType: "STOCK_ADJUSTMENT_OUT",
                                qty: revertQtyNum,
                                txnDateTime: new Date(),
                                remarks: `GRN Reversal: ${existing.grnNumber}`,
                            },
                        });
                    }

                    if (revAdjustmentItems.length > 0) {
                        await tx.stockAdjustment.create({
                            data: {
                                adjustmentNumber: revAdjustmentNumber,
                                adjustmentDate: new Date(),
                                reason: `Auto-generated Reversal due to update of Bill: ${existing.invoiceNo}`,
                                status: "APPROVED",
                                approvedBy: existing.createdBy,
                                approvedAt: new Date(),
                                createdBy: existing.createdBy,
                                updatedBy: existing.createdBy,
                                autoGenerated: true,
                                sourceDocument: "GrnInvoice",
                                sourceDocId: existing.id,
                                type: "Reversal",
                                items: {
                                    create: revAdjustmentItems
                                }
                            }
                        });
                    }

                    // Apply new stock levels
                    const newAdjustmentNumber = `ADJ-GRN-${existing.grnNumber}-${Date.now().toString().slice(-4)}`;
                    const newAdjustmentItems = [];

                    for (const item of itemsToCreate) {
                        const rawMaterial = await tx.rawMaterial.findUnique({
                            where: { rawMaterialId: item.productId },
                        });
                        if (!rawMaterial) {
                            throw new ApiError(404, `Raw Material ${item.productId} not found`);
                        }

                        let itemTypeStr = rawMaterial.itemType;
                        if (!itemTypeStr) {
                            itemTypeStr = "Raw Material";
                            await tx.rawMaterial.update({
                                where: { rawMaterialId: item.productId },
                                data: {
                                    itemType: "Raw Material",
                                    flaggedForReview: true
                                }
                            });
                        }

                        let enumType: any = "RAW_MATERIAL";
                        const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                        if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                            enumType = "RAW_MATERIAL";
                        } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                            enumType = "FINISHED_GOODS";
                        } else if (normalized === "SEMI_FINISHED") {
                            enumType = "SEMI_FINISHED";
                        } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                            enumType = "CONSUMABLE";
                        }

                        const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                        const newQtyNum = Number(item.quantity);
                        const adjustedQtyNum = currentQtyNum + newQtyNum;

                        newAdjustmentItems.push({
                            itemType: enumType,
                            rawMaterialId: item.productId,
                            storeId: storeId,
                            currentQty: currentQtyNum,
                            adjustedQty: adjustedQtyNum,
                            difference: newQtyNum,
                            unitCost: Number(item.unitPrice),
                            batchNo: rawMaterial.batchNo || null,
                            remarks: `Updated receipt from GRN ${existing.grnNumber}`
                        });

                        await tx.rawMaterial.update({
                            where: { rawMaterialId: item.productId },
                            data: {
                                onHandQty: {
                                    increment: newQtyNum,
                                },
                                lastMovementAt: new Date(),
                            },
                        });

                        await tx.rawMaterialTransaction.create({
                            data: {
                                storeId: storeId,
                                rawMaterialId: item.productId,
                                txnType: "RECEIPT",
                                qty: newQtyNum,
                                txnDateTime: new Date(data.grnDate || existing.grnDate),
                                remarks: `GRN Updated (Auto Adjustment): ${existing.grnNumber}`,
                            },
                        });
                    }

                    if (newAdjustmentItems.length > 0) {
                        await tx.stockAdjustment.create({
                            data: {
                                adjustmentNumber: newAdjustmentNumber,
                                adjustmentDate: new Date(data.grnDate || existing.grnDate),
                                reason: `Auto-generated on update of Bill: ${data.invoiceNo || existing.invoiceNo}`,
                                status: "APPROVED",
                                approvedBy: existing.createdBy,
                                approvedAt: new Date(),
                                createdBy: existing.createdBy,
                                updatedBy: existing.createdBy,
                                autoGenerated: true,
                                sourceDocument: "GrnInvoice",
                                sourceDocId: existing.id,
                                type: "Receipt",
                                items: {
                                    create: newAdjustmentItems
                                }
                            }
                        });
                    }
                }
            }

            return updated;
        });

        try {
            const { voucherPostingService } = require("../accounts/voucherPosting.service");
            await voucherPostingService.postPaymentVouchersForGRN(updated.id);
        } catch (vErr) {
            console.error("[Auto-Post Voucher Error] Failed to post Payment Vouchers for updated GRN:", vErr);
        }

        return updated;
    }

    // ── Delete ──────────────────────────────────────────────────────────────────
    async deleteGrnInvoice(id: string) {
        const existing = await prisma.grnInvoice.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!existing) {
            throw new ApiError(404, "GRN Invoice not found");
        }

        return prisma.$transaction(async (tx) => {
            if (existing.updateStock) {
                const revAdjustmentNumber = `ADJ-REV-${existing.grnNumber}`;
                const revAdjustmentItems = [];

                for (const item of existing.items) {
                    const rawMaterial = await tx.rawMaterial.findUnique({
                        where: { rawMaterialId: item.productId },
                    });
                    if (!rawMaterial) continue;

                    let itemTypeStr = rawMaterial.itemType || "Raw Material";
                    let enumType: any = "RAW_MATERIAL";
                    const normalized = itemTypeStr.toUpperCase().replace(/\s+/g, "_");
                    if (normalized === "RAW_MATERIAL" || normalized === "RAW_MATERIALS") {
                        enumType = "RAW_MATERIAL";
                    } else if (normalized === "FINISHED_GOOD" || normalized === "FINISHED_GOODS") {
                        enumType = "FINISHED_GOODS";
                    } else if (normalized === "SEMI_FINISHED") {
                        enumType = "SEMI_FINISHED";
                    } else if (normalized === "CONSUMABLE" || normalized === "CONSUMABLES") {
                        enumType = "CONSUMABLE";
                    }

                    const currentQtyNum = Number(rawMaterial.onHandQty) || 0;
                    const revertQtyNum = Number(item.quantity);
                    const adjustedQtyNum = currentQtyNum - revertQtyNum;

                    revAdjustmentItems.push({
                        itemType: enumType,
                        rawMaterialId: item.productId,
                        storeId: existing.storeId,
                        currentQty: currentQtyNum,
                        adjustedQty: adjustedQtyNum,
                        difference: -revertQtyNum,
                        unitCost: Number(item.unitPrice),
                        batchNo: rawMaterial.batchNo || null,
                        remarks: `Reversal of GRN ${existing.grnNumber} due to deletion`
                    });

                    await tx.rawMaterial.update({
                        where: { rawMaterialId: item.productId },
                        data: {
                            onHandQty: {
                                decrement: revertQtyNum,
                            },
                        },
                    });

                    await tx.rawMaterialTransaction.create({
                        data: {
                            storeId: existing.storeId,
                            rawMaterialId: item.productId,
                            txnType: "STOCK_ADJUSTMENT_OUT",
                            qty: revertQtyNum,
                            txnDateTime: new Date(),
                            remarks: `GRN Deleted: ${existing.grnNumber}`,
                        },
                    });
                }

                if (revAdjustmentItems.length > 0) {
                    await tx.stockAdjustment.create({
                        data: {
                            adjustmentNumber: revAdjustmentNumber,
                            adjustmentDate: new Date(),
                            reason: `Auto-generated Reversal on Deletion of Bill: ${existing.invoiceNo}`,
                            status: "APPROVED",
                            approvedBy: existing.createdBy,
                            approvedAt: new Date(),
                            createdBy: existing.createdBy,
                            updatedBy: existing.createdBy,
                            autoGenerated: true,
                            sourceDocument: "GrnInvoice",
                            sourceDocId: existing.id,
                            type: "Reversal",
                            items: {
                                create: revAdjustmentItems
                            }
                        }
                    });
                }
            }

            // Restore PO status on deletion
            if (existing.poId) {
                const po = await tx.purchaseOrder.findUnique({
                    where: { id: existing.poId },
                    include: { items: true },
                });
                if (po) {
                    let allFullyReceived = true;
                    let hasPartialReceived = false;

                    for (const poItem of po.items) {
                        const item = existing.items.find((i) => i.productId === poItem.productId);
                        const currentRec = Number(poItem.receivedQty) || 0;
                        const removedRec = item ? Number(item.quantity) : 0;
                        const newRec = Math.max(0, currentRec - removedRec);

                        if (removedRec > 0) {
                            await tx.purchaseOrderItem.update({
                                where: { id: poItem.id },
                                data: { receivedQty: newRec },
                            });
                        }

                        if (newRec < Number(poItem.quantity)) {
                            allFullyReceived = false;
                        }
                        if (newRec > 0) {
                            hasPartialReceived = true;
                        }
                    }

                    const newStatus = allFullyReceived
                        ? "CLOSED"
                        : hasPartialReceived
                            ? "PARTIALLY_RECEIVED"
                            : "OPEN";

                    await tx.purchaseOrder.update({
                        where: { id: existing.poId },
                        data: { status: newStatus },
                    });
                }
            }

            // Delete the invoice (items will Cascade delete)
            await tx.grnInvoice.delete({
                where: { id },
            });
        }, { timeout: 30000, maxWait: 10000 });
    }
}

export default new GrnInvoiceService();
