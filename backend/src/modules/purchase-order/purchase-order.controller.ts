import { Request, Response } from "express";

import purchaseOrderService from "./purchase-order.service";
import { prisma } from "../../config/prisma";
import { getIO } from "../../socket/socket";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { generatePoInvoiceHtml } from "../../templates/poInvoiceTemplate";
import { generatePdfFromHtml } from "../../utils/pdfGenerator";
import { sendEmail } from "../../utils/mailer";
import { WhatsappService } from "../whatsappservice/whatsapp.service";

class PurchaseOrderController {

    create = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new ApiError(401, "Unauthorized: missing user context");
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            throw new ApiError(500, "Internal Server Error: No company found in the system");
        }

        const po = await purchaseOrderService.createPurchaseOrder(req.body, {
            userId,
            companyId: company.id,
        });

        getIO().emit("purchaseOrder:created", po);

        return res.status(201).json(
            new ApiResponse("Purchase Order created successfully", po)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const { page, pageSize, search, status, fromDate, toDate } = req.query;
        const result = await purchaseOrderService.getAllPurchaseOrders({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search as string,
            status: status as string,
            fromDate: fromDate as string,
            toDate: toDate as string,
        });

        return res.status(200).json(
            new ApiResponse("Purchase Orders fetched successfully", result)
        );
    });

    findOne = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const po = await purchaseOrderService.getPurchaseOrderById(id);

        return res.status(200).json(
            new ApiResponse("Purchase Order fetched successfully", po)
        );
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const oldPo = await purchaseOrderService.getPurchaseOrderById(id);
        const po = await purchaseOrderService.updatePurchaseOrder(id, req.body);

        if (oldPo.status !== "APPROVED" && po.status === "APPROVED") {
            // Fire-and-forget: send WhatsApp notification in the background
            // so the API response returns immediately
            (async () => {
                try {
                    const fullPo = await purchaseOrderService.getPurchaseOrderById(id);
                    const companyDetails = await prisma.company.findFirst();
                    const supplier = fullPo.supplier;

                    let recipientPhone = "";
                    if (supplier?.mobile) {
                        if (Array.isArray(supplier.mobile) && supplier.mobile.length > 0) {
                            const firstMobile: any = supplier.mobile[0];
                            recipientPhone = firstMobile.number || firstMobile.value || "";
                        } else if (typeof supplier.mobile === "string") {
                            recipientPhone = supplier.mobile as string;
                        }
                    }

                    if (!recipientPhone && supplier?.altPhone) {
                        recipientPhone = supplier.altPhone;
                    }

                    if (recipientPhone && companyDetails && supplier) {
                        const formattedPhone = recipientPhone.replace(/^\+/, "");
                        const html = generatePoInvoiceHtml(fullPo, companyDetails, supplier);
                        const pdfBuffer = await generatePdfFromHtml(html);
                        const filename = `PO-${fullPo.poNumber}.pdf`;

                        const mediaId = await WhatsappService.uploadMedia(pdfBuffer, filename, "application/pdf");
                        const message = `Dear ${supplier.supplierName},\n\nYour Purchase Order ${fullPo.poNumber} has been approved. Please find the attached document for your reference.\n\nBest regards,\n${companyDetails.companyName}`;

                        await WhatsappService.sendDocumentMessage(formattedPhone, mediaId, filename, message);
                    }
                } catch (err) {
                    console.error("Failed to auto-send WhatsApp on PO approval", err);
                }
            })();
        }

        getIO().emit("purchaseOrder:updated", po);

        return res.status(200).json(
            new ApiResponse("Purchase Order updated successfully", po)
        );
    });

    getNextCode = asyncHandler(async (req: Request, res: Response) => {
        const nextCode = await purchaseOrderService.getNextPONumber();

        return res.status(200).json(
            new ApiResponse("Next PO number fetched successfully", nextCode)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        await purchaseOrderService.deletePurchaseOrder(id);

        getIO().emit("purchaseOrder:deleted", { id });

        return res.status(200).json(
            new ApiResponse("Purchase Order deleted successfully")
        );
    });

    emailPoInvoice = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const { to, subject, message } = req.body;

        if (!to) {
            throw new ApiError(400, "Recipient email (to) is required");
        }

        const po = await purchaseOrderService.getPurchaseOrderById(id);
        const companyDetails = await prisma.company.findFirst();

        const supplier = po.supplier;

        const html = generatePoInvoiceHtml(po, companyDetails, supplier);
        
        const pdfBuffer = await generatePdfFromHtml(html);

        await sendEmail({
            to,
            subject: subject || `Purchase Order Invoice - ${po.poNumber}`,
            text: message || `Please find attached the Purchase Order Invoice ${po.poNumber}.`,
            attachments: [
                {
                    filename: `PO-Invoice-${po.poNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });

        res.status(200).json(new ApiResponse("Purchase Order invoice emailed successfully"));
    });

    whatsappPO = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const { to, message } = req.body;

        if (!to) {
            throw new ApiError(400, "Recipient phone number is required");
        }

        const po = await purchaseOrderService.getPurchaseOrderById(id);
        const companyDetails = await prisma.company.findFirst();
        const supplier = po.supplier;

        const html = generatePoInvoiceHtml(po, companyDetails, supplier);
        const pdfBuffer = await generatePdfFromHtml(html);
        
        const filename = `PO-${po.poNumber}.pdf`;
        
        const { WhatsappService } = require("../whatsappservice/whatsapp.service");

        const mediaId = await WhatsappService.uploadMedia(pdfBuffer, filename, "application/pdf");

        await WhatsappService.sendDocumentMessage(to, mediaId, filename, message || `Purchase Order ${po.poNumber}`);

        res.status(200).json(new ApiResponse("WhatsApp message sent successfully!"));
    });
}

export default new PurchaseOrderController();