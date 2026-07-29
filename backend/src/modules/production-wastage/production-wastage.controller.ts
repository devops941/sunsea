import { Request, Response } from "express";
import productionWastageService from "./production-wastage.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class ProductionWastageController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543";
    const record = await productionWastageService.create(req.body, userId);

    getIO().emit("productionWastage:created", record);

    return res.status(201).json(
      new ApiResponse("Production wastage log created successfully", record)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const { productionOrderId, machineId, shiftId, productId, status } = req.query;
    const result = await productionWastageService.findAll({
      page,
      limit,
      productionOrderId: productionOrderId ? String(productionOrderId) : undefined,
      machineId: machineId ? String(machineId) : undefined,
      shiftId: shiftId ? String(shiftId) : undefined,
      productId: productId ? String(productId) : undefined,
      status: status ? String(status) : undefined,
    });

    return res.status(200).json(
      new ApiResponse("Production wastage logs fetched successfully", result)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const record = await productionWastageService.findById(BigInt(id as string));

    return res.status(200).json(
      new ApiResponse("Production wastage log fetched successfully", record)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543";
    const record = await productionWastageService.update(BigInt(id as string), req.body, userId);

    getIO().emit("productionWastage:updated", record);

    return res.status(200).json(
      new ApiResponse("Production wastage log updated successfully", record)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await productionWastageService.delete(BigInt(id as string));

    getIO().emit("productionWastage:deleted", { id: String(id) });

    return res.status(200).json(
      new ApiResponse("Production wastage log deleted successfully")
    );
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543";
    const record = await productionWastageService.approve(BigInt(id as string), userId);

    getIO().emit("productionWastage:updated", record);

    return res.status(200).json(
      new ApiResponse("Production wastage log approved successfully", record)
    );
  });

  reject = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.userId || "d67768ba-bcde-4321-a123-bcdef9876543";
    const record = await productionWastageService.reject(BigInt(id as string), userId);

    getIO().emit("productionWastage:updated", record);

    return res.status(200).json(
      new ApiResponse("Production wastage log rejected successfully", record)
    );
  });
}

export default new ProductionWastageController();
