import { Request, Response } from "express";
import locationService from "./location.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class LocationController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const location = await locationService.create(req.body, userId);

    return res.status(201).json(
      new ApiResponse("Location created successfully", location)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const {
      search,
      locationType,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await locationService.findAll({
      search: search as string | undefined,
      locationType: locationType as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
    });

    return res.status(200).json(
      new ApiResponse("Locations fetched successfully", result)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.findById(String(req.params.locationId));

    return res.status(200).json(
      new ApiResponse("Location fetched successfully", location)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const location = await locationService.update(
      String(req.params.locationId),
      req.body,
      userId
    );

    return res.status(200).json(
      new ApiResponse("Location updated successfully", location)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await locationService.delete(String(req.params.locationId));

    return res.status(200).json(
      new ApiResponse("Location deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await locationService.getNextLocationId();

    return res.status(200).json(
      new ApiResponse("Next location ID fetched successfully", { nextId })
    );
  });
}

export default new LocationController();
