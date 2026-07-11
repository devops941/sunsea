import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { prisma } from "../../config/prisma";

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
      })
    );
  });

  /**
   * Saves or updates the WhatsApp business configuration in the database.
   * Access token is stored hashed.
   */
  saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumberId, wabaId, businessPhone, accessToken } = req.body;

    if (!phoneNumberId || !wabaId || !businessPhone || !accessToken) {
      throw new ApiError(400, "All fields (phoneNumberId, wabaId, businessPhone, accessToken) are required.");
    }

    // if (!/^\d{10,15}$/.test(businessPhone)) {
    //   throw new ApiError(400, "Business phone number must contain digits only (10 to 15 digits).");
    // }

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

    // Only hash and update the access token if it's not the placeholder
    if (accessToken !== "••••••••••••••••••••") {
      hashedAccessToken = await bcrypt.hash(accessToken, 10);
    }

    if (!hashedAccessToken) {
      throw new ApiError(400, "Access token is required.");
    }

    // Upsert the configuration for the company
    const config = await prisma.whatsappConfig.upsert({
      where: { companyId: company.id },
      update: {
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        businessPhone: businessPhone.trim(),
        accessToken: hashedAccessToken,
      },
      create: {
        companyId: company.id,
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        businessPhone: businessPhone.trim(),
        accessToken: hashedAccessToken,
      },
    });

    return res.status(200).json(
      new ApiResponse("WhatsApp configuration saved successfully", {
        id: config.id,
        phoneNumberId: config.phoneNumberId,
        wabaId: config.wabaId,
        businessPhone: config.businessPhone,
        hasAccessToken: true,
      })
    );
  });
}

export const whatsappController = new WhatsappController();
export default whatsappController;
