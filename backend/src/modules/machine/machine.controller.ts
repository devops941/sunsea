import { Request, Response } from "express";
import machineService from "./machine.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class MachineController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
    const machine = await machineService.create({ ...req.body, userId });

    try {
      getIO().emit("machine:created", machine);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    return res.status(201).json(
      new ApiResponse("Machine created successfully", machine)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { search, page, limit, sortBy, sortOrder } = req.query;
    const machines = await machineService.findAll({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 15,
      sortBy: sortBy as string | undefined,
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    });

    return res.status(200).json(
      new ApiResponse("Machines fetched successfully", machines)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const machine = await machineService.findById(String(req.params.machineId));

    return res.status(200).json(
      new ApiResponse("Machine fetched successfully", machine)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
    const machine = await machineService.update(String(req.params.machineId), { ...req.body, userId });

    try {
      getIO().emit("machine:updated", machine);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    return res.status(200).json(
      new ApiResponse("Machine updated successfully", machine)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
    await machineService.delete(String(req.params.machineId), userId);

    try {
      getIO().emit("machine:deleted", { id: req.params.machineId, machineId: req.params.machineId });
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    return res.status(200).json(
      new ApiResponse("Machine deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextCode = await machineService.getNextMachineId();
    return res.status(200).json(
      new ApiResponse("Next machine ID generated successfully", { nextId: nextCode })
    );
  });
}

export default new MachineController();
