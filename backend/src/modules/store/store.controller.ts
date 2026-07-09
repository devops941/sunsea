import { Request, Response } from "express";
import storeService from "./store.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class StoreController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const store = await storeService.create(req.body, userId);

    return res.status(201).json(
      new ApiResponse("Store created successfully", store)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const {
      search,
      storeTypeId,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const stores = await storeService.findAll({
      search: search as string | undefined,
      storeTypeId: storeTypeId
        ? parseInt(storeTypeId as string, 10)
        : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
    });

    return res.status(200).json(
      new ApiResponse("Stores fetched successfully", stores)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const store = await storeService.findById(String(req.params.storeId));

    return res.status(200).json(
      new ApiResponse("Store fetched successfully", store)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const store = await storeService.update(String(req.params.storeId), req.body, userId);

    return res.status(200).json(
      new ApiResponse("Store updated successfully", store)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await storeService.delete(String(req.params.storeId));

    return res.status(200).json(
      new ApiResponse("Store deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await storeService.getNextStoreId();

    return res.status(200).json(
      new ApiResponse("Next store ID fetched successfully", { nextId })
    );
  });
}

export default new StoreController();
