import { Request, Response } from "express";

import productService from "./product.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class ProductController {
  create = asyncHandler(
    async (req: Request, res: Response) => { console.log('=== CREATE REQ.BODY ===', req.body);
      const product =
        await productService.create(
          req.body,
          req.files as Express.Multer.File[] | undefined
        );

      return res.status(201).json(
        new ApiResponse(
          "Product created successfully",
          product
        )
      );
    }
  );

  findAll = asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const search = req.query.search ? String(req.query.search) : undefined;
      const products =
        await productService.findAll(search);

      return res.status(200).json(
        new ApiResponse(
          "Products fetched successfully",
          products
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const product =
        await productService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Product fetched successfully",
          product
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const product =
        await productService.update(
          id,
          req.body,
          req.files as Express.Multer.File[] | undefined
        );

      return res.status(200).json(
        new ApiResponse(
          "Product updated successfully",
          product
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      await productService.delete(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Product deleted successfully"
        )
      );
    }
  );

  getNextId = asyncHandler(
    async (req: Request, res: Response) => {
      const nextId =
        await productService.getNextProductId();

      return res.status(200).json(
        new ApiResponse(
          "Next Product ID fetched successfully",
          { nextId }
        )
      );
    }
  );
}

export default new ProductController();