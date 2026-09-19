import { Request, Response } from "express";
import { WhatsappService } from "./whatsapp.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { prisma } from "../../config/prisma";
import { logAudit } from "../../utils/auditLog.util";

class WhatsappController {
  /**
   * Fetches the existing WhatsApp configuration.
   */
  getConfig = asyncHandler(async (req: Request, res: Response) => {
    // Get the default company
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "No company found in the system. Please set up a company first.");
    }

    const config = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    if (!config) {
      return res.status(200).json(
        new ApiResponse("No WhatsApp configuration found", null)
      );
    }

    return res.status(200).json(
      new ApiResponse("WhatsApp configuration fetched successfully", {
        phoneNumberId: config.phoneNumberId,
        wabaId: config.wabaId,
        businessPhone: config.businessPhone,
        hasAccessToken: !!config.accessToken,
        webhookVerifyToken: config.webhookVerifyToken,
      })
    );
  });

  /**
   * Saves or updates the WhatsApp business configuration in the database.
   * Access token is securely encrypted before storage.
   */
  saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumberId, wabaId, businessPhone, accessToken, webhookVerifyToken } = req.body;

    if (!phoneNumberId || !wabaId || !businessPhone || !accessToken) {
      throw new ApiError(400, "All fields (phoneNumberId, wabaId, businessPhone, accessToken) are required.");
    }

    // Get the default company
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "No company found in the system. Please set up a company first.");
    }

    // Check if configuration already exists
    const existingConfig = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    let hashedAccessToken = existingConfig?.accessToken;

    // Only encrypt and update the access token if it's not the placeholder
    if (accessToken !== "••••••••••••••••••••") {
      hashedAccessToken = WhatsappService.encryptText(accessToken);
    }

    if (!hashedAccessToken) {
      throw new ApiError(400, "Access token is required.");
    }

    const updatedConfig = await prisma.whatsappConfig.upsert({
      where: { companyId: company.id },
      update: {
        phoneNumberId,
        wabaId,
        businessPhone,
        accessToken: hashedAccessToken,
        webhookVerifyToken,
      },
      create: {
        companyId: company.id,
        phoneNumberId,
        wabaId,
        businessPhone,
        accessToken: hashedAccessToken,
        webhookVerifyToken,
      },
    });

    const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
    await logAudit("WhatsappConfig", updatedConfig.companyId, "UPDATE", userId, company.companyName + " WhatsApp Config");

    return res.status(200).json(
      new ApiResponse("WhatsApp configuration saved successfully", {
        phoneNumberId: updatedConfig.phoneNumberId,
        wabaId: updatedConfig.wabaId,
        businessPhone: updatedConfig.businessPhone,
        hasAccessToken: !!updatedConfig.accessToken,
        webhookVerifyToken: updatedConfig.webhookVerifyToken,
      })
    );
  });

  /**
   * Send a WhatsApp message
   */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { to, message } = req.body;

    if (!to || !message) {
      throw new ApiError(400, "Recipient phone number (to) and message are required.");
    }

    const result = await WhatsappService.sendTemplateMessage(to, "hello_world");

    return res.status(200).json(new ApiResponse("Message sent successfully", result));
  });

  /**
   * GET /webhook - Verify webhook from Meta
   */
  verifyWebhook = asyncHandler(async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Get the default company and its WhatsApp config
    const company = await prisma.company.findFirst();
    if (company) {
      const config = await prisma.whatsappConfig.findUnique({
        where: { companyId: company.id },
      });

      if (mode === "subscribe" && token === config?.webhookVerifyToken) {
        // Validation successful
        return res.status(200).send(challenge);
      }
    }

    // Validation failed
    return res.sendStatus(403);
  });

  /**
   * POST /webhook - Receive incoming webhook events from Meta
   */
  handleWebhookEvent = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    // Log the incoming webhook event (for debugging)
    console.log("Received WhatsApp Webhook Event:", JSON.stringify(body, null, 2));

    // Acknowledge receipt of the webhook event
    return res.sendStatus(200);
  });
}

export const whatsappController = new WhatsappController();
export default whatsappController;
