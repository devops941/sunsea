import { Request, Response } from "express";
import categoryService from "./category.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class CategoryController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const category = await categoryService.create(req.body, userId);
    getIO().emit("category:created", category);

    return res.status(201).json(
      new ApiResponse("Category created successfully", category)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { search, type, isActive, status, page, limit, sortBy, sortOrder } = req.query;

    const parsedIsActive = isActive !== undefined
      ? isActive === "true"
      : (status !== undefined ? status === "Active" : undefined);

    const result = await categoryService.findAll({
      search: search as string | undefined,
      type: type as string | undefined,
      isActive: parsedIsActive,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
    });

    return res.status(200).json(
      new ApiResponse("Categories fetched successfully", result)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const category = await categoryService.findById(id);

    return res.status(200).json(
      new ApiResponse("Category fetched successfully", category)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const id = parseInt(req.params.id as string, 10);
    const category = await categoryService.update(id, req.body, userId);
    getIO().emit("category:updated", category);

    return res.status(200).json(
      new ApiResponse("Category updated successfully", category)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.user?.userId;
    await categoryService.delete(id, userId);
    getIO().emit("category:deleted", { id });

    return res.status(200).json(
      new ApiResponse("Category deleted successfully")
    );
  });

  getNextCode = asyncHandler(async (req: Request, res: Response) => {
    const type = (req.query.type as string) || "PRODUCT";
    const nextCode = await categoryService.getNextCode(type);

    return res.status(200).json(
      new ApiResponse("Next category code fetched successfully", { nextCode })
    );
  });
}

export default new CategoryController();
