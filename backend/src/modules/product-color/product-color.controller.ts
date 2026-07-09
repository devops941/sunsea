import { Request, Response } from "express";

import productColorService from "./product-color.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class ProductColorController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const productColor =
        await productColorService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Product Color created successfully",
          productColor
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      _req: Request,
      res: Response
    ) => {
      const productColors =
        await productColorService.findAll();

      return res.status(200).json(
        new ApiResponse(
          "Product Colors fetched successfully",
          productColors
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const productColor =
        await productColorService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Product Color fetched successfully",
          productColor
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const productColor =
        await productColorService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Product Color updated successfully",
          productColor
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      await productColorService.delete(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Product Color deleted successfully"
        )
      );
    }
  );
}

export default new ProductColorController();