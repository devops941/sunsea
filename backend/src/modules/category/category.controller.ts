import { Request, Response } from "express";

import categoryService from "./category.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { getIO } from "../../socket/socket";

class CategoryController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const category =
        await categoryService.create(req.body);

      getIO().emit("category:created", category);

      return res.status(201).json(
        new ApiResponse(
          "Category created successfully",
          category
        )
      );
    }
  );

  findAll = asyncHandler(
    async (req: Request, res: Response) => {
      const search = req.query.search as string;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;

      const categories =
        await categoryService.findAll(search, isActive);

      return res.status(200).json(
        new ApiResponse(
          "Categories fetched successfully",
          categories
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const category =
        await categoryService.findById(id);

      return res.status(200).json(
        new ApiResponse(
          "Category fetched successfully",
          category
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const category =
        await categoryService.update(
          id,
          req.body
        );

      getIO().emit("category:updated", category);

      return res.status(200).json(
        new ApiResponse(
          "Category updated successfully",
          category
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      await categoryService.delete(id);

      getIO().emit("category:deleted", { id });

      return res.status(200).json(
        new ApiResponse(
          "Category deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (req: Request, res: Response) => {
      const nextId =
        await categoryService.getNextCategoryId();

      return res.status(200).json(
        new ApiResponse(
          "Next Category ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new CategoryController();