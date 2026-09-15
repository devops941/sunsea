import { Request, Response } from "express";
import dailyPlanService from "./daily-plan.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class DailyPlanController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const dailyPlan = await dailyPlanService.create(req.body, userId);
    const safePlan = JSON.parse(JSON.stringify(dailyPlan, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("dailyPlan:created", safePlan);
    return res.status(201).json(new ApiResponse("Daily Production Plan created successfully", dailyPlan));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { dailyPlanId } = req.params;
    const dailyPlan = await dailyPlanService.update(dailyPlanId as string, req.body, userId);
    const safePlan = JSON.parse(JSON.stringify(dailyPlan, (_key, value) =>
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

  bulkCreate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const plans = await dailyPlanService.bulkCreate(req.body, userId);
    const safePlans = JSON.parse(JSON.stringify(plans, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("dailyPlan:bulkCreated", { count: plans.length });
    return res.status(201).json(new ApiResponse(`${plans.length} Daily Production Plan(s) processed successfully`, safePlans));
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    const { dailyPlanIds } = req.body;
    const result = await dailyPlanService.bulkDelete(dailyPlanIds);
    getIO().emit("dailyPlan:bulkDeleted", { dailyPlanIds: result.deleted });
    return res.status(200).json(new ApiResponse(`${result.deleted.length} Daily Production Plan(s) deleted successfully`, result));
  });


  getRmIssuedDates = asyncHandler(async (req: Request, res: Response) => {
    const { weekStart } = req.query;
    if (!weekStart) {
      return res.status(400).json({ success: false, message: "weekStart query parameter is required (YYYY-MM-DD)" });
    }
    const dates = await dailyPlanService.getRmIssuedDates(weekStart as string);
    return res.status(200).json(new ApiResponse("RM issued dates fetched", dates));
  });

  getRmRequirements = asyncHandler(async (req: Request, res: Response) => {
    const { date, weekStart, shiftId, machineId, productId } = req.query;
    if (!date && !weekStart) {
      return res.status(400).json({ success: false, message: "date or weekStart query parameter is required (YYYY-MM-DD)" });
    }
    const result = await dailyPlanService.getRawMaterialRequirements({
      date: date ? String(date) : undefined,
      weekStart: weekStart ? String(weekStart) : undefined,
      shiftId: shiftId ? String(shiftId) : undefined,
      machineId: machineId ? String(machineId) : undefined,
      productId: productId ? String(productId) : undefined,
    });
    return res.status(200).json(new ApiResponse("Raw material requirements fetched", result));
  });

  issueRawMaterials = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId!;
    const { date, items } = req.body;
    const result = await dailyPlanService.issueRawMaterialsForDay(date, items, userId);
    return res.status(200).json(new ApiResponse("Raw materials issued successfully", result));
  });

  getWeekProducts = asyncHandler(async (req: Request, res: Response) => {
    const { machineId, weekStart } = req.query;
    if (!machineId || !weekStart || typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ success: false, message: "machineId and weekStart (YYYY-MM-DD) query parameters are required" });
    }
    const result = await dailyPlanService.getWeekProducts(String(machineId), weekStart);
    return res.status(200).json(new ApiResponse("Week products fetched successfully", result));
  });

  checkWeek = asyncHandler(async (req: Request, res: Response) => {
    const { weekStart } = req.query;
    if (!weekStart || typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ success: false, message: "weekStart is required (YYYY-MM-DD)" });
    }
    const result = await dailyPlanService.checkWeek(weekStart);
    return res.status(200).json(new ApiResponse("Week check completed", result));
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
