import { Request, Response } from "express";
import dailyPlanService from "./daily-plan.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class DailyPlanController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const dailyPlan = await dailyPlanService.create(req.body, userId);
    const safePlan = JSON.parse(JSON.stringify(dailyPlan, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("dailyPlan:created", safePlan);
    return res.status(201).json(new ApiResponse("Daily Production Plan created successfully", dailyPlan));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { dailyPlanId } = req.params;
    const dailyPlan = await dailyPlanService.update(dailyPlanId as string, req.body, userId);
    const safePlan = JSON.parse(JSON.stringify(dailyPlan, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("dailyPlan:updated", safePlan);
    return res.status(200).json(new ApiResponse("Daily Production Plan updated successfully", dailyPlan));
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { dailyPlanId } = req.params;
    await dailyPlanService.delete(dailyPlanId as string);
    getIO().emit("dailyPlan:deleted", { dailyPlanId: String(dailyPlanId) });
    return res.status(200).json(new ApiResponse("Daily Production Plan deleted successfully"));
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { dailyPlanId } = req.params;
    const dailyPlan = await dailyPlanService.findById(dailyPlanId as string);
    return res.status(200).json(new ApiResponse("Daily Production Plan fetched successfully", dailyPlan));
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { weeklyProgramId, productionOrderId, machineId, shiftId, productionDate, status, page, limit } = req.query;

    const filters = {
      weeklyProgramId: weeklyProgramId ? String(weeklyProgramId) : undefined,
      productionOrderId: productionOrderId ? String(productionOrderId) : undefined,
      machineId: machineId ? String(machineId) : undefined,
      shiftId: shiftId ? String(shiftId) : undefined,
      productionDate: productionDate ? String(productionDate) : undefined,
      status: status ? String(status) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };

    const dailyPlans = await dailyPlanService.findAll(filters);
    return res.status(200).json(new ApiResponse("Daily Production Plans fetched successfully", dailyPlans));
  });
}

export default new DailyPlanController();
