import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { uploadToImageKit } from "../../utils/Imagekit";
import { UpdateCompanyInput } from "./company.validation";
import fs from "fs";
import path from "path";

class CompanyService {
  /**
   * Fetch the main company (assuming single-tenant/single company setup).
   */
  async getCompany() {
    let company = await prisma.company.findFirst({
      include: {
        businessPlaces: true,
      },
    });

    if (!company) {
      // Create a default company if none exists
      company = await prisma.company.create({
        data: {
          companyCode: "COMP-001",
          companyName: "Default Company",
          legalName: "Default Company",
          currencyCode: "INR",
        },
        include: {
          businessPlaces: true,
        },
      });
    }

    // Convert BigInt IDs in businessPlaces to strings for JSON serialization
    if (company && company.businessPlaces) {
      company.businessPlaces = company.businessPlaces.map((bp) => ({
        ...bp,
        id: bp.id.toString(),
      })) as any;
    }

    return company;
  }

  /**
   * Update the company and its business places
   */
  async updateCompany(id: string, data: UpdateCompanyInput, userId: string, logoFile?: Express.Multer.File) {
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      throw new ApiError(404, "Company not found");
    }

    const { businessPlaces, companyName, ...companyData } = data;

    // Check if a new logo file was uploaded
    if (logoFile) {
      const fileName = `logo_${Date.now()}${path.extname(logoFile.originalname)}`;
      companyData.logoUrl = await uploadToImageKit(logoFile.path, fileName, "/company-logos")

      // Clean up the local temp file after upload
      try {
        fs.unlinkSync(logoFile.path);
      } catch (err) {
        console.error("Failed to delete temp file:", logoFile.path, err);
      }
    }

    // Ensure companyName is populated for backwards compatibility if needed
    const actualCompanyName = companyData.legalName || companyName || existingCompany.companyName;

    return prisma.$transaction(async (tx) => {
      // Update Company
      const updatedCompany = await tx.company.update({
        where: { id },
        data: {
          ...(companyData as any),
          companyName: actualCompanyName,
          isOnboarded: true,
          updatedBy: userId.startsWith("admin_") ? null : userId,
        },
      });

      // Handle Business Places
      if (businessPlaces && Array.isArray(businessPlaces)) {
        const existingBps = await tx.businessPlace.findMany({
          where: { companyId: id },
        });

        const incomingIds = businessPlaces
          .filter((bp) => bp.id)
          .map((bp) => BigInt(bp.id as string));

        // Delete places that are no longer in the payload
        const placesToDelete = existingBps.filter((bp) => !incomingIds.includes(bp.id));
        if (placesToDelete.length > 0) {
          await tx.businessPlace.deleteMany({
            where: {
              id: {
                in: placesToDelete.map((bp) => bp.id),
              },
            },
          });
        }

        // Upsert incoming places
        for (const bp of businessPlaces) {
          if (bp.id) {
            // Update
            await tx.businessPlace.update({
              where: { id: BigInt(bp.id as string) },
              data: {
                code: bp.code,
                name: bp.name,
                type: bp.type,
                gstPlaceCode: bp.gstPlaceCode,
                phone: bp.phone,
                email: bp.email,
                isHeadOffice: bp.isHeadOffice,
                isActive: bp.isActive,
                address: bp.address ?? undefined,
              },
            });
          } else {
            // Create
            await tx.businessPlace.create({
              data: {
                companyId: id,
                code: bp.code,
                name: bp.name,
                type: bp.type,
                gstPlaceCode: bp.gstPlaceCode,
                phone: bp.phone,
                email: bp.email,
                isHeadOffice: bp.isHeadOffice,
                isActive: bp.isActive,
                address: bp.address ?? undefined,
              },
            });
          }
        }
      }

      // Fetch fresh data
      const finalCompany = await tx.company.findUnique({
        where: { id },
        include: { businessPlaces: true },
      });

      if (finalCompany && finalCompany.businessPlaces) {
        finalCompany.businessPlaces = finalCompany.businessPlaces.map((bp) => ({
          ...bp,
          id: bp.id.toString(),
        })) as any;
      }

      return finalCompany;
    });
  }
}

export default new CompanyService();
