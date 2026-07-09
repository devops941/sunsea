import { Request, Response } from "express";
import rawMaterialStockService from "./raw-material-stock.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class RawMaterialStockController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const stock = await rawMaterialStockService.create(req.body);

    return res.status(201).json(
      new ApiResponse("Raw Material Stock created successfully", stock)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { search, storeId } = req.query;
    const stocks = await rawMaterialStockService.findAll({
      search: search as string,
      storeId: storeId as string
    });

    return res.status(200).json(
      new ApiResponse("Raw Material Stocks fetched successfully", stocks)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stock = await rawMaterialStockService.findById(String(id));

    return res.status(200).json(
      new ApiResponse("Raw Material Stock fetched successfully", stock)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stock = await rawMaterialStockService.update(
      String(id),
      req.body
    );

    return res.status(200).json(
      new ApiResponse("Raw Material Stock updated successfully", stock)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await rawMaterialStockService.delete(String(id));

    return res.status(200).json(
      new ApiResponse("Raw Material Stock deleted successfully")
    );
  });
}

export default new RawMaterialStockController();
