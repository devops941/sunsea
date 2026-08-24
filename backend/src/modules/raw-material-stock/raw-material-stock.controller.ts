import { Request, Response } from "express";
import rawMaterialStockService from "./raw-material-stock.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class RawMaterialStockController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const stock = await rawMaterialStockService.create(req.body);

    const safeStock = JSON.parse(JSON.stringify(stock, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("rawMaterialStock:created", safeStock);

    return res.status(201).json(
      new ApiResponse("Raw Material Stock created successfully", stock)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { search, storeId, storeCategory, itemType, categoryId, status } = req.query;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await rawMaterialStockService.findAll({
      search: search as string,
      storeId: storeId as string,
      storeCategory: storeCategory as string,
      itemType: itemType as string,
      categoryId: categoryId as string,
      status: status as string,
      page,
      limit,
    });

    return res.status(200).json(
      new ApiResponse("Raw Material Stocks fetched successfully", result)
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

    const safeStock = JSON.parse(JSON.stringify(stock, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("rawMaterialStock:updated", safeStock);

    return res.status(200).json(
      new ApiResponse("Raw Material Stock updated successfully", stock)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await rawMaterialStockService.delete(String(id));

    getIO().emit("rawMaterialStock:deleted", { id: String(id) });

    return res.status(200).json(
      new ApiResponse("Raw Material Stock deleted successfully")
    );
  });
}

export default new RawMaterialStockController();
