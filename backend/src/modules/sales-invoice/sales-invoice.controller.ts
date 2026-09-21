import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import salesInvoiceService from "./sales-invoice.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import companyService from "../company/company.service";
import { generateInvoiceHtml } from "../../templates/invoiceTemplate";
import { generatePdfFromHtml } from "../../utils/pdfGenerator";
import { sendEmail } from "../../utils/mailer";
import { getIO } from "../../socket/socket";

import { voucherPostingService } from "../accounts/voucherPosting.service";

class SalesInvoiceController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const salesInvoice = await salesInvoiceService.createSalesInvoice(req.body, {
      userId,
      companyId,
    });

    // Auto-post sales and receipt vouchers immediately on creation
    try {
      await voucherPostingService.postSalesVoucher(salesInvoice.id);
    } catch (err) {
      console.error("[Sales Invoice Controller] Voucher posting failed:", err);
    }

    getIO().emit("salesInvoice:created", salesInvoice);
    try {
      getIO().emit("voucher:created", { source: "salesInvoice" });
      getIO().emit("payment:created", { source: "salesInvoice" });
      getIO().emit("accountLedger:updated", { source: "salesInvoice" });
    } catch (e) {}

    return res.status(201).json(
      new ApiResponse("Sales Invoice created successfully", salesInvoice)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const { page, pageSize, search, customerId, fromDate, toDate } = req.query;

    const result = await salesInvoiceService.getAllSalesInvoices({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string,
      customerId: customerId as string,
      fromDate: fromDate as string,
      toDate: toDate as string,
      companyId,
    });

    return res.status(200).json(
      new ApiResponse("Sales Invoices fetched successfully", result)
    );
  });

  findOne = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    const salesInvoice = await salesInvoiceService.getSalesInvoiceById(id, companyId);

    return res.status(200).json(
      new ApiResponse("Sales Invoice fetched successfully", salesInvoice)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    await salesInvoiceService.deleteSalesInvoice(id, companyId, req.user?.userId);

    getIO().emit("salesInvoice:deleted", { id });
    try {
      getIO().emit("voucher:deleted", { id });
      getIO().emit("payment:deleted", { id });
      getIO().emit("accountLedger:updated", { source: "salesInvoice" });
    } catch (e) {}

    return res.status(200).json(
      new ApiResponse("Sales Invoice deleted successfully")
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    const salesInvoice = await salesInvoiceService.updateSalesInvoice(id, req.body, {
      userId,
      companyId,
    });

    // Auto-post sales and receipt vouchers immediately on update
    try {
      await voucherPostingService.postSalesVoucher(salesInvoice.id);
    } catch (err) {
      console.error("[Sales Invoice Controller] Voucher posting failed:", err);
    }

    getIO().emit("salesInvoice:updated", salesInvoice);
    try {
      getIO().emit("voucher:updated", { source: "salesInvoice" });
      getIO().emit("payment:updated", { source: "salesInvoice" });
      getIO().emit("accountLedger:updated", { source: "salesInvoice" });
    } catch (e) {}

    return res.status(200).json(
      new ApiResponse("Sales Invoice updated successfully", salesInvoice)
    );
  });

  emailInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { recipientEmail, subject, message } = req.body;

    if (!recipientEmail) {
      return res.status(400).json(new ApiResponse("Recipient email is required"));
    }

    const company = await companyService.getCompany();
    if (!company) {
      return res.status(500).json(new ApiResponse("Company not found"));
    }

    const invoice = await salesInvoiceService.getSalesInvoiceById(id as string, company.id);
    if (!invoice) {
      return res.status(404).json(new ApiResponse("Invoice not found"));
    }

    const htmlContent = generateInvoiceHtml(invoice, company);
    const pdfBuffer = await generatePdfFromHtml(htmlContent);

    await sendEmail({
      to: recipientEmail,
      subject: subject || `Invoice ${invoice.invoiceNo}`,
      text: message || `Please find the attached invoice.`,
      attachments: [
        {
          filename: `Invoice-${invoice.invoiceNo}.pdf`,
          content: pdfBuffer,
        }
      ]
    });

    return res.status(200).json(new ApiResponse("Email sent successfully!"));
  });
  whatsappInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { to, message } = req.body;

    if (!to) {
      return res.status(400).json(new ApiResponse("Recipient phone number is required"));
    }

    const company = await companyService.getCompany();
    if (!company) {
      return res.status(500).json(new ApiResponse("Company not found"));
    }

    const invoice = await salesInvoiceService.getSalesInvoiceById(id as string, company.id);
    if (!invoice) {
      return res.status(404).json(new ApiResponse("Invoice not found"));
    }

    // 1. Generate PDF buffer
    const htmlContent = generateInvoiceHtml(invoice, company);
    const pdfBuffer = await generatePdfFromHtml(htmlContent);
    
    const filename = `Invoice-${invoice.invoiceNo}.pdf`;
    
    const { WhatsappService } = require("../whatsappservice/whatsapp.service");

    // 2. Upload media
    const mediaId = await WhatsappService.uploadMedia(pdfBuffer, filename, "application/pdf");

    // 3. Send message with the document
    await WhatsappService.sendDocumentMessage(to, mediaId, filename, message || `Invoice ${invoice.invoiceNo}`);

    return res.status(200).json(new ApiResponse("WhatsApp message sent successfully!"));
  });
}

export const salesInvoiceController = new SalesInvoiceController();
export default salesInvoiceController;
