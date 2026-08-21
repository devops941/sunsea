import { Request, Response } from "express";
import rawMaterialService from "./raw-material.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class RawMaterialController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const rawMaterial = await rawMaterialService.create(req.body, userId);

    getIO().emit("rawMaterial:created", rawMaterial);

    return res.status(201).json(
      new ApiResponse("Raw Material created successfully", rawMaterial)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const search = req.query.search as string | undefined;
    const storeId = req.query.storeId as string | undefined;
    const itemType = req.query.itemType as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const status = req.query.status as string | undefined;
    const isActive =
      req.query.isActive === "true" ? true :
        req.query.isActive === "false" ? false :
          undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as "asc" | "desc" | undefined;

    const result = await rawMaterialService.findAll({
      search, storeId, isActive, itemType, categoryId, status, page, limit, sortBy, sortOrder,
    });

    return res.status(200).json(
      new ApiResponse("Raw Materials fetched successfully", result)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const rawMaterial = await rawMaterialService.findById(String(req.params.rawMaterialId));

    return res.status(200).json(
      new ApiResponse("Raw Material fetched successfully", rawMaterial)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const rawMaterial = await rawMaterialService.update(
      String(req.params.rawMaterialId),
      req.body,
      userId
    );

    getIO().emit("rawMaterial:updated", rawMaterial);

    return res.status(200).json(
      new ApiResponse("Raw Material updated successfully", rawMaterial)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const rawMaterialId = String(req.params.rawMaterialId);
    await rawMaterialService.delete(rawMaterialId, userId);

    getIO().emit("rawMaterial:deleted", { id: rawMaterialId });

    return res.status(200).json(
      new ApiResponse("Raw Material deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await rawMaterialService.getNextRawMaterialId();

    return res.status(200).json(
      new ApiResponse("Next Raw Material ID fetched successfully", { nextId })
    );
  });
}

export default new RawMaterialController();
