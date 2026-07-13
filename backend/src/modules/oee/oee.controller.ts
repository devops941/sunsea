import { Request, Response } from "express";
import oeeService from "./oee.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class OeeController {
  /** GET /api/oee/machine/:machineId/summary */
  getMachineOeeSummary = asyncHandler(async (req: Request, res: Response) => {
    const machineId = String(req.params.machineId);
    const date = req.query.date ? String(req.query.date) : undefined;
    const summary = await oeeService.getMachineOeeSummary(machineId, date);
    return res.status(200).json(new ApiResponse("Machine OEE summary fetched", summary));
  });

  /** GET /api/oee/production-order/:productionOrderId */
  getProductionOrderOee = asyncHandler(async (req: Request, res: Response) => {
    const productionOrderId = String(req.params.productionOrderId);
    const summary = await oeeService.getProductionOrderOeeSummary(productionOrderId);
    return res.status(200).json(new ApiResponse("Production Order OEE fetched", summary));
  });

  /** GET /api/oee/machines/status */
  getAllMachinesStatus = asyncHandler(async (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    const statuses = await oeeService.getAllMachinesStatus(date);
    return res.status(200).json(new ApiResponse("All machine statuses fetched", statuses));
  });
}

export default new OeeController();
