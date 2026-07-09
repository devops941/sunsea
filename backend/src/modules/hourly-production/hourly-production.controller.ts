import { Request, Response } from "express";
import hourlyProductionService from "./hourly-production.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class HourlyProductionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const log = await hourlyProductionService.create(req.body);

    return res.status(201).json(
      new ApiResponse("Hourly Production log created successfully", log)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { machineId, shiftId, productionDate, productionOrderId, search } = req.query;
    const logs = await hourlyProductionService.findAll({
      machineId: machineId ? String(machineId) : undefined,
      shiftId: shiftId ? String(shiftId) : undefined,
      productionDate: productionDate ? String(productionDate) : undefined,
      productionOrderId: productionOrderId ? String(productionOrderId) : undefined,
      search: search ? String(search) : undefined,
    });

    return res.status(200).json(
      new ApiResponse("Hourly Production logs fetched successfully", logs)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { hourlyProductionId } = req.params;
    const log = await hourlyProductionService.findById(BigInt(String(hourlyProductionId)));

    return res.status(200).json(
      new ApiResponse("Hourly Production log fetched successfully", log)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { hourlyProductionId } = req.params;
    const log = await hourlyProductionService.update(BigInt(String(hourlyProductionId)), req.body);

    return res.status(200).json(
      new ApiResponse("Hourly Production log updated successfully", log)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { hourlyProductionId } = req.params;
    await hourlyProductionService.delete(BigInt(String(hourlyProductionId)));

    return res.status(200).json(
      new ApiResponse("Hourly Production log deleted successfully")
    );
  });
}

export default new HourlyProductionController();
