import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { prisma } from "../../config/prisma";

class InvoiceSettingsController {
  getConfig = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "No company found in the system. Please set up a company first.");
    }

    let config = await prisma.invoiceSetting.findUnique({
      where: { companyId: company.id },
    });

    // If no config, return default values
    if (!config) {
      const currentYear = new Date().getFullYear();
      const fyStart = new Date(`${currentYear}-04-01`);
      const fyEnd = new Date(`${currentYear + 1}-03-31`);

      return res.status(200).json(
        new ApiResponse("Invoice settings fetched successfully (defaults)", {
          invoicePrefix: "INV",
          sequenceLength: 4,
          currentSequenceNumber: 1,
          financialYearStart: fyStart,
          financialYearEnd: fyEnd,
          autoFinancialYear: true,
          formatTemplate: "{PREFIX}-{FY}-{SEQ}",
        })
      );
    }

    return res.status(200).json(
      new ApiResponse("Invoice settings fetched successfully", config)
    );
  });

  saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const {
      invoicePrefix,
      sequenceLength,
      currentSequenceNumber,
      financialYearStart,
      financialYearEnd,
      autoFinancialYear,
      formatTemplate
    } = req.body;

    if (!invoicePrefix || !sequenceLength || !financialYearStart || !financialYearEnd || !formatTemplate) {
      throw new ApiError(400, "Required fields are missing.");
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "No company found in the system.");
    }

    const config = await prisma.invoiceSetting.upsert({
      where: { companyId: company.id },
      update: {
        invoicePrefix: invoicePrefix.trim(),
        sequenceLength: Number(sequenceLength),
        currentSequenceNumber: currentSequenceNumber !== undefined ? Number(currentSequenceNumber) : undefined,
        financialYearStart: new Date(financialYearStart),
        financialYearEnd: new Date(financialYearEnd),
        autoFinancialYear: Boolean(autoFinancialYear),
        formatTemplate: formatTemplate.trim(),
      },
      create: {
        companyId: company.id,
        invoicePrefix: invoicePrefix.trim(),
        sequenceLength: Number(sequenceLength),
        currentSequenceNumber: currentSequenceNumber !== undefined ? Number(currentSequenceNumber) : 1,
        financialYearStart: new Date(financialYearStart),
        financialYearEnd: new Date(financialYearEnd),
        autoFinancialYear: Boolean(autoFinancialYear),
        formatTemplate: formatTemplate.trim(),
      },
    });

    return res.status(200).json(
      new ApiResponse("Invoice settings saved successfully", config)
    );
  });
}

export const invoiceSettingsController = new InvoiceSettingsController();
export default invoiceSettingsController;
