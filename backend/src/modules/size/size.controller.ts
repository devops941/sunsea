import { Request, Response } from "express";

import sizeService from "./size.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class SizeController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const size =
        await sizeService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Size created successfully",
          size
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const search = req.query.search as string;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      const sizes =
        await sizeService.findAll(search, isActive);

      return res.status(200).json(
        new ApiResponse(
          "Sizes fetched successfully",
          sizes
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const size =
        await sizeService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Size fetched successfully",
          size
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      const size =
        await sizeService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Size updated successfully",
          size
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(
        String(req.params.id)
      );

      await sizeService.delete(id);

      return res.status(200).json(
        new ApiResponse(
          "Size deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (req: Request, res: Response) => {
      const nextId =
        await sizeService.getNextSizeId();

      return res.status(200).json(
        new ApiResponse(
          "Next Size ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new SizeController();