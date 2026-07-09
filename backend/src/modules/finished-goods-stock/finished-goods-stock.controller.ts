import { Request, Response } from "express";
import finishedGoodsStockService from "./finished-goods-stock.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class FinishedGoodsStockController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const stock = await finishedGoodsStockService.create(req.body);

    return res.status(201).json(
      new ApiResponse("Finished Goods Stock created successfully", stock)
    );
  });

  findAll = asyncHandler(async (_req: Request, res: Response) => {
    const stocks = await finishedGoodsStockService.findAll();

    return res.status(200).json(
      new ApiResponse("Finished Goods Stocks fetched successfully", stocks)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { storeId, productItemId } = req.params;
    const stock = await finishedGoodsStockService.findById(
      String(storeId),
      BigInt(String(productItemId))
    );

    return res.status(200).json(
      new ApiResponse("Finished Goods Stock fetched successfully", stock)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { storeId, productItemId } = req.params;
    const stock = await finishedGoodsStockService.update(
      String(storeId),
      BigInt(String(productItemId)),
      req.body
    );

    return res.status(200).json(
      new ApiResponse("Finished Goods Stock updated successfully", stock)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { storeId, productItemId } = req.params;
    await finishedGoodsStockService.delete(String(storeId), BigInt(String(productItemId)));

    return res.status(200).json(
      new ApiResponse("Finished Goods Stock deleted successfully")
    );
  });
}

export default new FinishedGoodsStockController();
