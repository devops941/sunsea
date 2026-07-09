import { Request, Response } from "express";
import dailyScheduleService from "./daily-schedule.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { GetDailyScheduleQueryInput } from "./daily-schedule.validation";

class DailyScheduleController {
  getDailySchedule = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as GetDailyScheduleQueryInput;

    const data = await dailyScheduleService.getDailySchedule(query);

    return res.status(200).json(
      new ApiResponse(
        "Daily Production Schedule fetched successfully",
        data
      )
    );
  });
}

export default new DailyScheduleController();
