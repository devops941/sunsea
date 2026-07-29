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

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const { storeId, search } = req.query;
    const result = await finishedGoodsStockService.findAll({
      page,
      limit,
      storeId: storeId as string,
      search: search as string,
    });

    return res.status(200).json(
      new ApiResponse("Finished Goods Stocks fetched successfully", result)
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
