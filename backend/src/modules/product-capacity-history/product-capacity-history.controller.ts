import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { productCapacityHistoryService } from "./product-capacity-history.service";

export class ProductCapacityHistoryController {
  findByProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = Number(req.params.productId);
    const records = await productCapacityHistoryService.findByProduct(productId);
    res.json(new ApiResponse("History fetched successfully", records));
  });

  getLatestByProductAndMachine = asyncHandler(async (req: Request, res: Response) => {
    const productId = Number(req.params.productId);
    const machineId = req.params.machineId as string;
    const record = await productCapacityHistoryService.getLatestByProductAndMachine(productId, machineId);
    res.json(new ApiResponse("Latest capacity fetched successfully", record));
  });

  manualChange = asyncHandler(async (req: Request, res: Response) => {
    const { productId, date, shift, machine, operators, newCapacity } = req.body;
    const updatedBy = (req as any).user?.userId || null;
    const record = await productCapacityHistoryService.manualChange({
      productId: Number(productId),
      date,
      shift,
      machine,
      operators,
      newCapacity: Number(newCapacity),
      updatedBy,
    });
    res.json(new ApiResponse("Capacity updated successfully", record));
  });
}

export const productCapacityHistoryController = new ProductCapacityHistoryController();
