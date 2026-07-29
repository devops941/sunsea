import { Request, Response } from "express";
import storeTypeService from "./store-type.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class StoreTypeController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const storeType = await storeTypeService.create(req.body);
    getIO().emit("store-type:created", storeType);
    res.status(201).json(
      new ApiResponse("Store Type created successfully", storeType)
    );
  });

findAll = asyncHandler(async (req: Request, res: Response) => {
  const {
    search,
    page,
    limit,
    sortBy,
    sortOrder,
  } = req.query;

  const storeTypes = await storeTypeService.findAll({
    search: search as string | undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    sortBy: sortBy as string | undefined,
    sortOrder: sortOrder as "asc" | "desc" | undefined,
  });

  res.status(200).json(
    new ApiResponse("Store Types fetched successfully", storeTypes)
  );
});

  findById = asyncHandler(async (req: Request, res: Response) => {
    const storeType = await storeTypeService.findById(Number(req.params.id));
    res.status(200).json(
      new ApiResponse("Store Type fetched successfully", storeType)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const storeType = await storeTypeService.update(Number(req.params.id), req.body);
    getIO().emit("store-type:updated", storeType);
    res.status(200).json(
      new ApiResponse("Store Type updated successfully", storeType)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await storeTypeService.delete(Number(req.params.id));
    getIO().emit("store-type:deleted", { id: req.params.id });
    res.status(200).json(
      new ApiResponse("Store Type deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await storeTypeService.getNextId();
    res.status(200).json(
      new ApiResponse("Next store type ID fetched successfully", { nextId })
    );
  });
}

export default new StoreTypeController();
