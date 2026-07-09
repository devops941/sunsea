import { Request, Response } from "express";
import machineService from "./machine.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class MachineController {
  
  create = asyncHandler(async (req: Request, res: Response) => {
    const machine = await machineService.create(req.body);

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

    return res.status(200).json(
      new ApiResponse("Machine updated successfully", machine)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await machineService.delete(String(req.params.machineId));

    return res.status(200).json(
      new ApiResponse("Machine deleted successfully")
    );
  });

  getNextId = asyncHandler(async (_req: Request, res: Response) => {
    const nextId = await machineService.getNextMachineId();
    return res.status(200).json(
      new ApiResponse("Next machine ID generated successfully", { nextId })
    );
  });
}

export default new MachineController();
