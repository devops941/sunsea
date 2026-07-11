import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import companyService from "./company.service";
import { updateCompanySchema } from "./company.validation";
import { ApiError } from "../../utils/ApiError";

class CompanyController {
  getCompany = asyncHandler(async (req: Request, res: Response) => {
    const company = await companyService.getCompany();
    return res.status(200).json(new ApiResponse("Company fetched successfully", company));
  });

  updateCompany = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543";

    // Since multipart/form-data doesn't automatically parse nested objects/arrays or typed primitives,
    // let's parse stringified fields if they are sent as strings.
    if (typeof req.body.businessPlaces === "string") {
      try {
        req.body.businessPlaces = JSON.parse(req.body.businessPlaces);
      } catch (err) {
        throw new ApiError(400, "Invalid format for businessPlaces");
      }
    }
    if (req.body.isActive === "true" || req.body.isActive === "false") {
      req.body.isActive = req.body.isActive === "true";
    }
    if (req.body.isOnboarded === "true" || req.body.isOnboarded === "false") {
      req.body.isOnboarded = req.body.isOnboarded === "true";
    }

    // Validate request body
    const parsedData = updateCompanySchema.parse(req.body);

    const updatedCompany = await companyService.updateCompany(id, parsedData, userId, req.file);
    return res.status(200).json(new ApiResponse("Company updated successfully", updatedCompany));
  });
}

export default new CompanyController();
