import { Request, Response } from "express";

import productPricingService from "./product-pricing.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class ProductPricingController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const pricing =
        await productPricingService.create(
          req.body
        );

      return res.status(201).json(
        new ApiResponse(
          "Product Pricing created successfully",
          pricing
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
      const pricing =
        await productPricingService.findAll(search);

      return res.status(200).json(
        new ApiResponse(
          "Product Pricings fetched successfully",
          pricing
        )
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const pricing =
        await productPricingService.findById(
          id
        );

      return res.status(200).json(
        new ApiResponse(
          "Product Pricing fetched successfully",
          pricing
        )
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      const pricing =
        await productPricingService.update(
          id,
          req.body
        );

      return res.status(200).json(
        new ApiResponse(
          "Product Pricing updated successfully",
          pricing
        )
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = BigInt(
        String(req.params.id)
      );

      await productPricingService.delete(
        id
      );

      return res.status(200).json(
        new ApiResponse(
          "Product Pricing deleted successfully"
        )
      );
    }
  );
}

export default new ProductPricingController();