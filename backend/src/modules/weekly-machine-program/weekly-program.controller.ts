import { Request, Response } from "express";
import weeklyProgramService from "./weekly-program.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class WeeklyProgramController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    const weeklyProgram = await weeklyProgramService.create(
      req.body,
      userId
    );

    return res.status(201).json(
      new ApiResponse(
        "Weekly Program created successfully",
        weeklyProgram
      )
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { machineId, weekStartDate, search } = req.query;
    
    const filters = {
      machineId: machineId ? String(machineId) : undefined,
      weekStartDate: weekStartDate ? String(weekStartDate) : undefined,
      search: search ? String(search) : undefined,
    };

    const weeklyPrograms =
      await weeklyProgramService.findAll(filters);

    return res.status(200).json(
      new ApiResponse(
        "Weekly Programs fetched successfully",
        weeklyPrograms
      )
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { weeklyProgramId } = req.params;

    const weeklyProgram =
      await weeklyProgramService.findById(
        weeklyProgramId as string
      );

    return res.status(200).json(
      new ApiResponse(
        "Weekly Program fetched successfully",
        weeklyProgram
      )
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    const weeklyProgram =
      await weeklyProgramService.update(
        req.params.weeklyProgramId as string,
        req.body,
        userId
      );

    return res.status(200).json(
      new ApiResponse(
        "Weekly Program updated successfully",
        weeklyProgram
      )
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await weeklyProgramService.delete(
      req.params.weeklyProgramId as string
    );

    return res.status(200).json(
      new ApiResponse(
        "Weekly Program deleted successfully"
      )
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId =
      await weeklyProgramService.getNextWeeklyProgramId();

    return res.status(200).json(
      new ApiResponse(
        "Next Weekly Program ID fetched successfully",
        { nextId }
      )
    );
  });

  getDailyPlanning = asyncHandler(async (req: Request, res: Response) => {
    const { machineId, weekStartDate } = req.query;
    const data = await weeklyProgramService.getDailyPlanningData(
      String(machineId),
      String(weekStartDate)
    );

    return res.status(200).json(
      new ApiResponse("Daily Planning data fetched successfully", data)
    );
  });
}

export default new WeeklyProgramController();