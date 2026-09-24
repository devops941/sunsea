import { Request, Response } from "express";

import productService from "./product.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { getIO } from "../../socket/socket";

class ProductController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.user?.userId;
      const product =
        await productService.create(
          req.body,
          req.files as Express.Multer.File[] | undefined,
          userId
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
      const isActive =
        req.query.isActive === "true" ? true :
          req.query.isActive === "false" ? false :
            undefined;
      const productType = req.query.productType ? String(req.query.productType) : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as "asc" | "desc" | undefined;

      const result = await productService.findAll({
        search,
        categoryId,
        isActive,
        productType,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      return res.status(200).json(
        new ApiResponse(
          "Products fetched successfully",
          result
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
      const userId = req.user?.userId;

      const product =
        await productService.update(
          id,
          req.body,
          req.files as Express.Multer.File[] | undefined,
          userId
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
      const userId = req.user?.userId;

      await productService.delete(
        id,
        userId
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