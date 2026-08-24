import { Request, Response } from "express";
import salesOrderService from "./sales-order.service";
import creditCheckService from "./creditCheckService";
import companyService from "../company/company.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";
import { generateQuotationHtml } from "../../templates/quotationTemplate";
import { generatePdfFromHtml } from "../../utils/pdfGenerator";
import { sendEmail } from "../../utils/mailer";
import {
    SalesOrderQueryInput,
    SalesOrderStatusEnum,
    SalesOrderStatus
} from "./sales-order.validation";

/** Extract permissions array from request user */
function getPerms(req: Request): string[] {
    return Array.isArray(req.user?.permissions) ? req.user.permissions : [];
}

class SalesOrderController {

    create = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.create(req.body, getPerms(req));
        getIO().emit("salesOrder:created", order);
        return res.status(201).json(new ApiResponse("Sales Order created successfully", order));
    });

    checkCreditBlock = asyncHandler(async (req: Request, res: Response) => {
        const customerId = req.query.customerId as string;
        if (!customerId) {
            return res.status(400).json(new ApiResponse("customerId is required", { blocked: false }));
        }
        const blockResult = await creditCheckService.hasBlockingPendingOrder(customerId);
        return res.status(200).json(new ApiResponse("Credit block check completed successfully", blockResult));
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const query: SalesOrderQueryInput = {
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
            customerId: req.query.customerId as string,
            orderNo: req.query.orderNo as string,
            docType: req.query.docType ? (req.query.docType as string).toUpperCase() : undefined,
            customerGradeId: req.query.customerGradeId ? Number(req.query.customerGradeId) : undefined,
            customerTypeId: req.query.customerTypeId ? Number(req.query.customerTypeId) : undefined,
            orderType: req.query.orderType as string | undefined,
            orderSource: req.query.orderSource as string | undefined,
            dispatchType: req.query.dispatchType as string | undefined,
            sourceEmployeeId: req.query.sourceEmployeeId ? Number(req.query.sourceEmployeeId) : undefined,
            status: this.parseSalesOrderStatuses(req.query.status),
            search: req.query.search as string,
            fromDate: req.query.fromDate as string,
            toDate: req.query.toDate as string,
            sortBy: this.parseSortBy(req.query.sortBy) ?? "createdAt",
            sortOrder: this.parseSortOrder(req.query.sortOrder) ?? "desc",
        };
        const orders = await salesOrderService.findAll(query, getPerms(req));
        return res.status(200).json(new ApiResponse("Sales Orders fetched successfully", orders));
    });

    findById = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.findById(Number(req.params.id), getPerms(req));
        return res.status(200).json(new ApiResponse("Sales Order fetched successfully", order));
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.update(Number(req.params.id), req.body, getPerms(req));
        getIO().emit("salesOrder:updated", order);
        return res.status(200).json(new ApiResponse("Sales Order updated successfully", order));
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        await salesOrderService.delete(id, getPerms(req));
        getIO().emit("salesOrder:deleted", { id });
        return res.status(200).json(new ApiResponse("Sales Order deleted successfully"));
    });

    getNextCode = asyncHandler(async (req: Request, res: Response) => {
        const nextCode = await salesOrderService.getNextSalesOrderCode(getPerms(req));
        return res.status(200).json(new ApiResponse("Next sales order code fetched successfully", { nextCode }));
    });


    getStatus = asyncHandler(async (req: Request, res: Response) => {
        const status = await salesOrderService.getOrderStatus(Number(req.params.id), getPerms(req));
        return res.status(200).json(new ApiResponse("Order status fetched successfully", status));
    });

    /** GET /:id/download-quotation — streams Quotation PDF */
    downloadQuotation = asyncHandler(async (req: Request, res: Response) => {
        const perms = getPerms(req);
        const order = await salesOrderService.findById(Number(req.params.id), perms);
        if (!order) return res.status(404).json(new ApiResponse("Order not found"));

        const company = await companyService.getCompany();
        const htmlContent = generateQuotationHtml(order, company);
        const pdfBuffer = await generatePdfFromHtml(htmlContent);

        const filename = `Quotation-${(order as any).orderNo}.pdf`;

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": pdfBuffer.length,
        });
        res.send(pdfBuffer);
    });

    emailQuotation = asyncHandler(async (req: Request, res: Response) => {
        const { recipientEmail, subject, message } = req.body;
        if (!recipientEmail) {
            return res.status(400).json(new ApiResponse("Recipient email is required"));
        }
        const perms = getPerms(req);
        const order = await salesOrderService.findById(Number(req.params.id), perms);
        if (!order) return res.status(404).json(new ApiResponse("Order not found"));

        const company = await companyService.getCompany();
        const htmlContent = generateQuotationHtml(order, company);
        const pdfBuffer = await generatePdfFromHtml(htmlContent);

        const filename = `Quotation-${(order as any).orderNo}.pdf`;

        await sendEmail({
            to: recipientEmail,
            subject: subject || `Quotation for Order ${(order as any).orderNo}`,
            text: message || `Please find the attached quotation.`,
            attachments: [{ filename, content: pdfBuffer }],
        });
        return res.status(200).json(new ApiResponse("Email sent successfully!"));
    });

    confirmOrder = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.confirmOrder(Number(req.params.id), getPerms(req));
        getIO().emit("salesOrder:updated", order);
        return res.status(200).json(new ApiResponse("Order confirmed successfully", order));
    });

    convertToSalesOrder = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.convertToSalesOrder(Number(req.params.id), getPerms(req));
        getIO().emit("salesOrder:updated", order);
        return res.status(200).json(new ApiResponse("Quotation converted to sales order successfully", order));
    });

    markInQuotation = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.markInQuotation(Number(req.params.id));
        getIO().emit("salesOrder:updated", order);
        return res.status(200).json(new ApiResponse("Order marked as in-quotation successfully", order));
    });

    getSourceOrders = asyncHandler(async (req: Request, res: Response) => {
        const customerId = req.query.customerId as string;
        if (!customerId) return res.status(400).json(new ApiResponse("customerId is required", []));
        const orders = await salesOrderService.getSourceOrders(customerId, getPerms(req));
        return res.status(200).json(new ApiResponse("Source orders fetched successfully", orders));
    });

    whatsappQuotation = asyncHandler(async (req: Request, res: Response) => {
        const { to, message } = req.body;
        if (!to) return res.status(400).json(new ApiResponse("Recipient phone number is required"));

        const perms = getPerms(req);
        const order = await salesOrderService.findById(Number(req.params.id), perms);
        if (!order) return res.status(404).json(new ApiResponse("Order not found"));

        const company = await companyService.getCompany();
        const htmlContent = generateQuotationHtml(order, company);
        const pdfBuffer = await generatePdfFromHtml(htmlContent);
        const filename = `Quotation-${(order as any).orderNo}.pdf`;
        const { WhatsappService } = require("../whatsappservice/whatsapp.service");
        const mediaId = await WhatsappService.uploadMedia(pdfBuffer, filename, "application/pdf");
        await WhatsappService.sendDocumentMessage(to, mediaId, filename, message || `Quotation for Order ${(order as any).orderNo}`);
        return res.status(200).json(new ApiResponse("WhatsApp message sent successfully!"));
    });

    // ─── Private helpers ──────────────────────────────────────────────────────

    private parseSortBy(value: unknown): "orderDate" | "createdAt" | "orderNo" | undefined {
        if (!value || typeof value !== "string") return undefined;
        const v = value.toLowerCase();
        return (v === "orderDate" || v === "createdAt" || v === "orderNo") ? v as any : undefined;
    }

    private parseSortOrder(value: unknown): "asc" | "desc" | undefined {
        if (!value || typeof value !== "string") return undefined;
        const v = value.toLowerCase();
        return (v === "asc" || v === "desc") ? v as any : undefined;
    }

    private parseSalesOrderStatuses(value: unknown): SalesOrderStatus[] | undefined {
        if (!value || typeof value !== "string") return undefined;
        const valid: SalesOrderStatus[] = [];
        for (const s of value.split(",").map(s => s.trim().toUpperCase())) {
            const r = SalesOrderStatusEnum.safeParse(s);
            if (r.success) valid.push(r.data);
        }
        return valid.length > 0 ? valid : undefined;
    }
}

export default new SalesOrderController();
