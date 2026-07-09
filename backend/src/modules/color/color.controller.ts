import { Request, Response } from "express";

import colorService from "./color.service";

import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class ColorController {

  /**
   * Create Color
   */
  create = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const color =
        await colorService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Color created successfully",
          color
        )
      );
    }
  );

  /**
   * Get All Colors
   */
  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const search = req.query.search as string;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;

      const colors =
        await colorService.findAll(search, isActive);

      return res.status(200).json(
        new ApiResponse(
          "Colors fetched successfully",
          colors
        )
      );
    }
  );

  /**
   * Get Color By Id
   */
  findById = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const color =
        await colorService.findById(
          Number(
            String(req.params.id)
          )
        );

      return res.status(200).json(
        new ApiResponse(
          "Color fetched successfully",
          color
        )
      );
    }
  );

  /**
   * Update Color
   */
  update = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      const color =
        await colorService.update(
          Number(
            String(req.params.id)
          ),
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Color updated successfully",
          color
        )
      );
    }
  );

  /**
   * Delete Color
   */
  delete = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {

      await colorService.delete(
        Number(
          String(req.params.id)
        )
      );

      return res.status(200).json(
        new ApiResponse(
          "Color deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (req: Request, res: Response) => {
      const nextId =
        await colorService.getNextColorId();

      return res.status(200).json(
        new ApiResponse(
          "Next Color ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new ColorController();