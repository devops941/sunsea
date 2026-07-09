import { Request, Response } from "express";
import rawMaterialCategoryService from "./raw-material-category.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class RawMaterialCategoryController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const category = await rawMaterialCategoryService.create(req.body, userId);

    return res.status(201).json(
      new ApiResponse("Raw Material Category created successfully", category)
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

  const categories = await rawMaterialCategoryService.findAll({
    search: search as string | undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    sortBy: sortBy as string | undefined,
    sortOrder: sortOrder as "asc" | "desc" | undefined,
  });

  return res.status(200).json(
    new ApiResponse(
      "Raw Material Categories fetched successfully",
      categories
    )
  );
});

  findById = asyncHandler(async (req: Request, res: Response) => {
    const category = await rawMaterialCategoryService.findById(Number(req.params.id));

    return res.status(200).json(
      new ApiResponse("Raw Material Category fetched successfully", category)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const category = await rawMaterialCategoryService.update(
      Number(req.params.id),
      req.body,
      userId
    );

    return res.status(200).json(
      new ApiResponse("Raw Material Category updated successfully", category)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    await rawMaterialCategoryService.delete(Number(req.params.id), userId);

    return res.status(200).json(
      new ApiResponse("Raw Material Category deleted successfully")
    );
  });

  getNextCode = asyncHandler(async (_req: Request, res: Response) => {
    const nextCode = await rawMaterialCategoryService.getNextCategoryCode();

    return res.status(200).json(
      new ApiResponse("Next Category Code fetched successfully", { nextId: nextCode })
    );
  });
}

export default new RawMaterialCategoryController();
