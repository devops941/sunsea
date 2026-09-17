import { Request, Response } from "express";
import shiftService from "./shift.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { getIO } from "../../socket/socket";

class ShiftController {
  create = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
      const shift = await shiftService.create({ ...req.body, userId });
      
      getIO().emit("shift:created", shift);
      
      return res.status(201).json(
        new ApiResponse("Shift created successfully", shift)
      );
    }
  );

  findAll = asyncHandler(
    async (_req: Request, res: Response) => {
      const shifts = await shiftService.findAll();
      return res.status(200).json(
        new ApiResponse("Shifts fetched successfully", shifts)
      );
    }
  );

  findById = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(String(req.params.id));
      const shift = await shiftService.findById(id);
      return res.status(200).json(
        new ApiResponse("Shift fetched successfully", shift)
      );
    }
  );

  update = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(String(req.params.id));
      const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
      const shift = await shiftService.update(id, { ...req.body, userId });
      
      getIO().emit("shift:updated", shift);
      
      return res.status(200).json(
        new ApiResponse("Shift updated successfully", shift)
      );
    }
  );

  delete = asyncHandler(
    async (req: Request, res: Response) => {
      const id = Number(String(req.params.id));
      await shiftService.delete(id);
      
      getIO().emit("shift:deleted", { id });
      
      return res.status(200).json(
        new ApiResponse("Shift deleted successfully")
      );
    }
  );

  getNextId = asyncHandler(
    async (_req: Request, res: Response) => {
      const nextId = await shiftService.getNextShiftId();
      return res.status(200).json(
        new ApiResponse("Next shift ID generated successfully", { nextId })
      );
    }
  );
}

export default new ShiftController();
