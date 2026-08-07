import { Request, Response } from "express";
import machineService from "./machine.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class MachineController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const machine = await machineService.create(req.body);

    try {
      getIO().emit("machine:created", machine);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    return res.status(201).json(
      new ApiResponse("Machine created successfully", machine)
    );
  });

  findAll = asyncHandler(async (_req: Request, res: Response) => {
    const machines = await machineService.findAll();

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
    const machine = await machineService.update(String(req.params.machineId), req.body);

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
    await machineService.delete(String(req.params.machineId));

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
