import { Request, Response } from "express";
import rawMaterialService from "./raw-material.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class RawMaterialController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const rawMaterial = await rawMaterialService.create(req.body, userId);

    return res.status(201).json(
      new ApiResponse("Raw Material created successfully", rawMaterial)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const search = req.query.search as string | undefined;
    const rawMaterials = await rawMaterialService.findAll(search);

    return res.status(200).json(
      new ApiResponse("Raw Materials fetched successfully", rawMaterials)
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

    return res.status(200).json(
      new ApiResponse("Raw Material updated successfully", rawMaterial)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    await rawMaterialService.delete(String(req.params.rawMaterialId), userId);

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
