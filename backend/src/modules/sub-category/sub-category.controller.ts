import { Request, Response } from "express";

import subCategoryService from "./sub-category.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class SubCategoryController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const subCategory =
        await subCategoryService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Sub Category created successfully",
          subCategory
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const search = req.query.search as string | undefined;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;
      // Separate from `search` on purpose — this is an exact filter
      // ("only this category's subcategories"), not free-text matching.
      const categoryId = req.query.categoryId
        ? Number(req.query.categoryId as string)
        : undefined;

      const subCategories =
        await subCategoryService.findAll(search, categoryId, isActive);

      return res.status(200).json(
        new ApiResponse(
          "Sub Categories fetched successfully",
          subCategories
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const subCategory =
        await subCategoryService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Sub Category fetched successfully",
          subCategory
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const subCategory =
        await subCategoryService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Sub Category updated successfully",
          subCategory
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      await subCategoryService.delete(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Sub Category deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (req: Request, res: Response) => {
      const nextId =
        await subCategoryService.getNextSubCategoryId();

      return res.status(200).json(
        new ApiResponse(
          "Next Sub Category ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new SubCategoryController();