import { Request, Response } from "express";

import salesProductService from "./salesProduct.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";

class SalesProductController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const salesProduct = await salesProductService.create(req.body);

    return res.status(201).json(
      new ApiResponse("Sales Product created successfully", salesProduct)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const search = req.query.search ? String(req.query.search) : undefined;
    const salesProducts = await salesProductService.findAll({ search });

    return res.status(200).json(
      new ApiResponse("Sales Products fetched successfully", salesProducts)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    const salesProduct = await salesProductService.findById(id);

    return res.status(200).json(
      new ApiResponse("Sales Product fetched successfully", salesProduct)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    const salesProduct = await salesProductService.update(id, req.body);

    return res.status(200).json(
      new ApiResponse("Sales Product updated successfully", salesProduct)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(String(req.params.id));
    await salesProductService.delete(id);

    return res.status(200).json(
      new ApiResponse("Sales Product deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await salesProductService.getNextSalesProductId();

    return res.status(200).json(
      new ApiResponse("Next Sales Product ID fetched successfully", { nextId })
    );
  });
}

export default new SalesProductController();
