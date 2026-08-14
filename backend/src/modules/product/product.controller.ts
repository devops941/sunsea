import { Request, Response } from "express";

import productService from "./product.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { getIO } from "../../socket/socket";

class ProductController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const product =
        await productService.create(
          req.body,
          req.files as Express.Multer.File[] | undefined
        );

      getIO().emit("product:created", product);

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
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
      const products =
        await productService.findAll({ search, categoryId });

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

      getIO().emit("product:updated", product);

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

      getIO().emit("product:deleted", { id: id.toString() });

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